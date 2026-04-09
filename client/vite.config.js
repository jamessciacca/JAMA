import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const configuredBase = process.env.VITE_BASE_PATH;
  const base = configuredBase || (mode === 'production' ? '/JAMA/' : '/');

  return {
    base,
    plugins: [react()],
  };
});
