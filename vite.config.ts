import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
    base: '/NewsProject/',
    plugins: [react(), viteSingleFile()],
    build: {
        assetsInlineLimit: 1000000,
    },
});
