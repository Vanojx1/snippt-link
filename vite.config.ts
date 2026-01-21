import { defineConfig } from 'vite';

export default defineConfig({
    // For GitHub Pages - use repo name as base path
    base: '/snippt-link/',
    build: {
        target: 'esnext',
    },
    optimizeDeps: {
        include: ['monaco-editor'],
    },
});
