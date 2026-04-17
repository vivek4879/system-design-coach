import type { Plugin } from "vite";
import { spawn } from "child_process";

const TIMEOUT_MS = 120_000;

// Serial request queue — only 1 CLI process at a time
let pending: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = pending.then(fn, fn);
  pending = result.then(() => {}, () => {});
  return result;
}

export function claudeProxy(): Plugin {
  return {
    name: "claude-proxy",
    configureServer(server) {
      server.middlewares.use("/api/claude", async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        let body: { prompt?: string; model?: string; effort?: string };
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON in request body" }));
          return;
        }

        if (!body.prompt) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing 'prompt' in request body" }));
          return;
        }

        try {
          const result = await enqueue(() =>
            runClaude(body.prompt!, body.model, body.effort)
          );
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (err) {
          const error = err as { status?: number; message: string };
          res.writeHead(error.status ?? 500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    },
  };
}

interface ProxyResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    costUsd: number;
    durationMs: number;
  };
}

function runClaude(
  prompt: string,
  model?: string,
  effort?: string
): Promise<ProxyResult> {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "json"];
    args.push("--model", model || "sonnet");
    if (effort) args.push("--effort", effort);

    const child = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      child.kill();
      reject({ status: 504, message: "Claude CLI timed out after 120 seconds" });
    }, TIMEOUT_MS);

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject({
          status: 503,
          message: "Claude CLI not found. Make sure 'claude' is installed and on your PATH.",
        });
      } else {
        reject({ status: 502, message: `Failed to start Claude CLI: ${err.message}` });
      }
    });

    child.on("close", (code) => {
      clearTimeout(timer);

      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString().trim();
        reject({
          status: 502,
          message: `Claude CLI exited with code ${code}: ${stderr || "unknown error"}`,
        });
        return;
      }

      const stdout = Buffer.concat(stdoutChunks).toString();
      try {
        const parsed = JSON.parse(stdout);
        resolve({
          text: parsed.result ?? "",
          usage: {
            inputTokens: parsed.usage?.input_tokens ?? 0,
            outputTokens: parsed.usage?.output_tokens ?? 0,
            cacheReadTokens: parsed.usage?.cache_read_input_tokens ?? 0,
            cacheCreationTokens: parsed.usage?.cache_creation_input_tokens ?? 0,
            costUsd: parsed.total_cost_usd ?? 0,
            durationMs: parsed.duration_ms ?? 0,
          },
        });
      } catch {
        reject({ status: 502, message: "Failed to parse Claude CLI output" });
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}
