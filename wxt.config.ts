import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

const HOST_PATTERNS = ['http://*/*', 'https://*/*']

// Learn more: https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    // WXT bundles its own Vite copy, so @tailwindcss/vite's `Plugin` type is a
    // different declaration of the same runtime object. Cast once, here.
    plugins: [tailwindcss() as never],
  }),
  manifest: (env) => ({
    name: 'Open SEO',
    short_name: 'Open SEO',
    description: 'Open-source, local-first SEO inspector for Chrome, Edge, and Firefox.',
    // Minimal permissions: `activeTab` grants access to the current tab only
    // when the user opens the popup; `scripting` lets us read that page's DOM.
    // `storage` keeps a site scan alive in the background. Host permissions are
    // optional and requested per origin, only when the user starts a site scan.
    permissions: ['activeTab', 'scripting', 'storage'],
    // MV3 has a dedicated key for optional hosts; MV2 (Firefox) wants them in
    // `optional_permissions`.
    ...(env.browser === 'firefox'
      ? { optional_permissions: HOST_PATTERNS }
      : { optional_host_permissions: HOST_PATTERNS }),
    action: {
      default_title: 'Open SEO',
    },
  }),
})
