// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.diariofederal.com.ar/',
  output: 'server',
  adapter: vercel({
    // Permite que Vercel achique y sirva desde nuestro dominio las fotos externas
    // (vista previa de WhatsApp/Facebook): /_vercel/image?url=...&w=1200&q=75
    imagesConfig: {
      sizes: [640, 1200],
      domains: [],
      remotePatterns: [{ protocol: 'https' }],
    },
  }),
  integrations: [mdx(), sitemap(), react()],

  vite: {
    plugins: [tailwindcss()],
    // Bundle the sanitizer and its ESM parser for Vercel's server runtime.
    ssr: {
      noExternal: ["dayjs", "dom-serializer", "domelementtype", "domhandler", "domutils", "entities", "escape-string-regexp", "htmlparser2", "is-plain-object", "launder", "nanoid", "parse-srcset", "picocolors", "postcss", "sanitize-html", "source-map-js"],
    },
  },
});
