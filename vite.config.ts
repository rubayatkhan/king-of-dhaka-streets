import { defineConfig } from 'vite';

// GitHub Pages serves the game from /<repo>/, so the deploy workflow sets BASE_PATH.
export default defineConfig({ base: process.env.BASE_PATH ?? '/' });
