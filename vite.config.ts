import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: {
        clientPort: 3000,
      },
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@supabase')) return 'vendor-supabase';
              if (id.includes('dexie')) return 'vendor-db';
              if (id.includes('groq-sdk') || id.includes('openai') || id.includes('google-generative-ai') || id.includes('@google')) return 'vendor-ai';
              if (id.includes('lucide-react') || id.includes('framer-motion')) return 'vendor-ui';
              if (id.includes('three') || id.includes('globe.gl') || id.includes('three-globe') || id.includes('react-globe.gl')) return 'vendor-viz';
              if (id.includes('pdfjs-dist')) return 'vendor-pdf';
              return 'vendor-core'; // Everything else in node_modules
            }
          }
        }
      },
      chunkSizeWarningLimit: 1000 // Raise limit slightly since we are manually chunking
    }
  };
});
