// Сборка библиотеки в dist/ (ESM). preact и htm остаются внешними — их даёт приложение.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'src/index.js', formats: ['es'], fileName: 'ui-kit' },
    rollupOptions: { external: [/^preact/, /^htm/] },
    cssCodeSplit: false,
    emptyOutDir: true,
  },
});
