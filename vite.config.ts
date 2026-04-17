import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { claudeProxy } from './server/claude-proxy'

export default defineConfig({
  plugins: [react(), claudeProxy()],
})
