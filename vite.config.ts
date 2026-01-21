import { defineConfig } from 'vite';

export default defineConfig({
    // For GitHub Pages - change to '/repo-name/' if not using custom domain
    base: '/',
    build: {
        target: 'esnext',
    },
    optimizeDeps: {
        include: ['monaco-editor'],
    },
});
