/**
 * A fake `chrome` API good enough for `wxt/browser` (which is just
 * `globalThis.chrome`) and for the webextension-polyfill WXT bundles: every
 * method supports both the callback and the promise style, like the real API.
 */

type Callback = (value?: unknown) => void

type Handler = (...args: unknown[]) => unknown

function dual(handler: Handler): (...args: unknown[]) => unknown {
  return (...args: unknown[]) => {
    const callback = typeof args[args.length - 1] === 'function' ? (args.pop() as Callback) : null
    if (callback) {
      void Promise.resolve()
        .then(() => handler(...args))
        .then(
          (value) => callback(value),
          () => {
            fakeChrome.runtime.lastError = { message: 'fake error' }
            callback(undefined)
            fakeChrome.runtime.lastError = undefined
          }
        )
      return undefined
    }
    return Promise.resolve().then(() => handler(...args))
  }
}

export interface FakeChrome {
  runtime: {
    id: string
    lastError?: { message: string }
    onMessage: { addListener: (fn: (...args: unknown[]) => unknown) => void; removeListener: (fn: (...args: unknown[]) => unknown) => void }
    sendMessage: (...args: unknown[]) => unknown
  }
  storage: {
    local: {
      get: (...args: unknown[]) => unknown
      set: (...args: unknown[]) => unknown
      remove: (...args: unknown[]) => unknown
    }
  }
  permissions: { contains: (...args: unknown[]) => unknown; request: (...args: unknown[]) => unknown }
  tabs: { query: (...args: unknown[]) => unknown }

  /** Raw contents of the fake `storage.local`. */
  data: Record<string, unknown>
  /** Every `runtime.sendMessage` call, in order. */
  sent: unknown[]
  /** When false, `storage` calls reject (quota exceeded, permission revoked). */
  storageAvailable: boolean
  /** When true, `runtime.sendMessage` rejects (a dead service worker). */
  messagingBroken: boolean
  /** Result of `tabs.query`. */
  tabUrl: string | null
  /** Simulates an install with no `storage` permission at all. */
  removeStorageNamespace: () => void
  restoreStorageNamespace: () => void
  reset: () => void
}

const listeners = new Set<(...args: unknown[]) => unknown>()

const storageNamespace = {
  local: {
    get: dual((keys?: unknown) => {
      const result: Record<string, unknown> = {}
      const list = Array.isArray(keys) ? keys : [keys]
      for (const key of list) {
        if (typeof key === 'string' && key.endsWith('*')) {
          for (const [name, value] of Object.entries(fakeChrome.data)) {
            if (name.startsWith(key.slice(0, -1))) result[name] = value
          }
        } else if (typeof key === 'string' && key in fakeChrome.data) {
          result[key] = fakeChrome.data[key]
        }
      }
      return result
    }),
    set: dual((items: unknown) => {
      if (!fakeChrome.storageAvailable) throw new Error('QUOTA_BYTES quota exceeded')
      Object.assign(fakeChrome.data, (items ?? {}) as Record<string, unknown>)
    }),
    remove: dual((key: unknown) => {
      if (!fakeChrome.storageAvailable) throw new Error('storage unavailable')
      for (const name of Array.isArray(key) ? key : [key]) delete fakeChrome.data[name as string]
    }),
  },
}

export const fakeChrome: FakeChrome = {
  data: {},
  sent: [],
  storageAvailable: true,
  messagingBroken: false,
  tabUrl: 'https://example.com/',

  runtime: {
    id: 'open-seo-test',
    lastError: undefined,
    onMessage: {
      addListener: (fn) => {
        listeners.add(fn)
      },
      removeListener: (fn) => {
        listeners.delete(fn)
      },
    },
    sendMessage: dual((message: unknown, ...rest: unknown[]) => {
      if (fakeChrome.messagingBroken) {
        throw new Error('Could not establish connection. Receiving end does not exist.')
      }
      fakeChrome.sent.push(message)

      const isBroadcast =
        Boolean(message) &&
        typeof message === 'object' &&
        (message as { type?: string }).type === 'site:state'

      // A `site:state` event is a broadcast: it reaches open extension pages but
      // expects no reply, so it resolves with undefined.
      const deliver = new Promise((resolve) => {
        let answered = false
        for (const listener of listeners) {
          const returned = listener(message, { id: 'caller' }, (response: unknown) => {
            if (!answered) {
              answered = true
              resolve(response)
            }
          })
          if (returned === true && !isBroadcast) return
        }
        if (!answered) resolve(undefined)
        void rest
      })
      return deliver
    }),
  },

  storage: storageNamespace,

  permissions: {
    contains: dual(() => true),
    request: dual(() => true),
  },

  tabs: {
    query: dual(() => (fakeChrome.tabUrl ? [{ id: 1, url: fakeChrome.tabUrl }] : [])),
  },

  removeStorageNamespace: () => {
    ;(fakeChrome as { storage?: unknown }).storage = undefined
  },

  restoreStorageNamespace: () => {
    ;(fakeChrome as { storage?: unknown }).storage = storageNamespace
  },

  reset: () => {
    fakeChrome.data = {}
    fakeChrome.sent = []
    fakeChrome.storageAvailable = true
    fakeChrome.messagingBroken = false
    fakeChrome.tabUrl = 'https://example.com/'
    fakeChrome.restoreStorageNamespace()
    listeners.clear()
  },
}
