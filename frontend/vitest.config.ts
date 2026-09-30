import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    css: true,
    testTimeout: 15_000,
    passWithNoTests: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        // 全量跑 110+ 个测试文件时，fork 子进程会触及 Node 默认堆上限而
        // 报 "Zone Allocation failed - process out of memory"，进而让大量用例
        // 假失败。这里显式提高子进程堆上限，保证 npm run test 在本地与 CI 上结果一致。
        execArgv: ['--max-old-space-size=6144'],
      },
    },
  },
})
