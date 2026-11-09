import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import { vaultFiles } from './src/data/vault.js';

const SITE = 'https://johnoosthuizen.com';
const keepOutOfSitemap = ['certs.pdf', 'transcripts.pdf'];

export default defineConfig({
  srcDir: './src',
  publicDir: './public',
  outDir: './dist',
  output: 'server',
  site: SITE,

  integrations: [
    sitemap({
      customPages: vaultFiles
        .filter(f => !keepOutOfSitemap.includes(f.slug))
        .map(f => `${SITE}/assets/${f.slug}`),
    }),
  ],

  adapter: cloudflare(),
});