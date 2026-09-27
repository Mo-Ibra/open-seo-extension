import { fakeChrome } from './helpers/fake-chrome'

// `wxt/browser` resolves to `globalThis.chrome` at import time, so the fake has
// to exist before any module under test is loaded.
;(globalThis as unknown as { chrome: typeof fakeChrome }).chrome = fakeChrome

export { fakeChrome }
