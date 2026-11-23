import { defineConfig, loadEnv } from 'vite';
import { aiProxy } from './server/aiProxy';

export default defineConfig(({ mode }) => {
  // Loaded only on the dev server; no VITE_ prefix, so the key is never exposed to the browser.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    // Relative base so the build works both locally and on GitHub Pages (/yuhui-station/).
    base: './',
    server: { port: 5180 },
    plugins: [aiProxy(env)],
  };
});
