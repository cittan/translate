import { defineConfig } from 'vite'
import monkey from 'vite-plugin-monkey'
import { meta } from './src/meta'

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        ...meta,
        // 开发态注入的运行时
        'run-at': 'document-idle',
      },
      server: {
        // 桌面/移动端 Tampermonkey 自动热更新
        open: false,
      },
    }),
  ],
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },
})
