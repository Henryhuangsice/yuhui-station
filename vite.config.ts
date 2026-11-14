import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works both locally and on GitHub Pages (/yuhui-station/).
  base: './',
  server: { port: 5180 },
});
