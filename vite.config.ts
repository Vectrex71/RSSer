import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    define: {
      // Keys are handled on the server-side in server.ts to prevent exposure to the browser.
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: (() => {
        let useMock = false;
        const baseDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
        try {
          if (env.VITE_USE_MOCK === 'true') {
            useMock = true;
          }
        } catch (e) {}

        const aliases: Record<string, string> = {
          '@': path.resolve(baseDir, '.'),
        };

        if (useMock) {
          aliases['firebase/auth'] = path.resolve(baseDir, './src/lib/mock-firebase-auth.ts');
          aliases['firebase/firestore'] = path.resolve(baseDir, './src/lib/mock-firebase-firestore.ts');
          aliases['firebase/storage'] = path.resolve(baseDir, './src/lib/mock-firebase-storage.ts');
        }
        return aliases;
      })(),
    },
    build: {
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
