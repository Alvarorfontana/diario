// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://diario-digital-mocha-iota.vercel.app',
  output: 'server',
  adapter: vercel(),
  integrations: [mdx(), sitemap(), react(), keystatic()],

  vite: {
    plugins: [tailwindcss()],
  },
});
