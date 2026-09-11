import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 项目站部署在 /albummm/ 子路径下，构建时需要 base；
// 本地 dev 保持根路径不变。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/albummm/' : '/',
  plugins: [react()],
  server: {
    // 编辑器的原子写会在项目根留下 `.<文件名>.<pid>.<uuid>.tmpdir/` 临时目录，
    // chokidar 在它被删掉的瞬间去 watch 会抛 EBUSY，未捕获的 error 事件会直接
    // 让 dev server 整个退出（「localhost 咋没了」）。这里把它们排除在监听之外。
    watch: {
      ignored: ['**/*.tmpdir', '**/*.tmpdir/**'],
    },
  },
}))
