import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5391 },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
