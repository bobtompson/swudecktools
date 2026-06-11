// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import cloudflare from '@astrojs/cloudflare';

// The Cloudflare adapter is only needed to emit the proxy endpoint as a Pages
// Function for the production build. `astro dev` serves that endpoint in-process
// with Node and does NOT need the adapter — loading it in dev would spawn
// `workerd`, which isn't reliably present in the Linux dev container.
const isDev = process.argv.includes('dev');

export default defineConfig({
  output: 'static',
  ...(isDev ? {} : { adapter: cloudflare() }),
  integrations: [svelte()],
});
