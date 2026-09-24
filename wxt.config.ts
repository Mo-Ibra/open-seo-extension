import { defineConfig } from 'wxt'

// Learn more: https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Open SEO',
    short_name: 'Open SEO',
    description: 'Open-source, local-first SEO inspector for Chrome, Edge, and Firefox.',
    // Minimal permissions: `activeTab` grants access to the current tab only
    // when the user opens the popup; `scripting` lets us read that page's DOM.
    permissions: ['activeTab', 'scripting'],
    action: {
      default_title: 'Open SEO',
    },
  },
})
