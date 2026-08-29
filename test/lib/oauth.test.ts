import {beforeEach, describe, expect, it, vi} from 'vitest'

const mocks = vi.hoisted(() => ({
  openBrowser: vi.fn<(_: string) => Promise<void>>(),
}))

vi.mock('open', () => ({
  default: mocks.openBrowser,
}))

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto')
  return {
    ...actual,
    randomBytes: (size: number) => Buffer.alloc(size, size === 16 ? 2 : 1),
  }
})

vi.mock('node:http', () => ({
  createServer: (listener: (request: {url: string}, response: FakeResponse) => void) => {
    const server = {
      close: vi.fn(),
      listen: vi.fn((_port: number, _host: string, onListening: () => void) => {
        onListening()
        listener(
          {url: '/callback?code=authorization-code&state=02020202020202020202020202020202'},
          {end: vi.fn(), writeHead: vi.fn()},
        )
      }),
      on: vi.fn(),
    }

    return server
  },
}))

interface FakeResponse {
  end: ReturnType<typeof vi.fn>
  writeHead: ReturnType<typeof vi.fn>
}

const {performLogin} = await import('../../src/lib/oauth.js')

describe('performLogin', () => {
  beforeEach(() => {
    mocks.openBrowser.mockReset()
    mocks.openBrowser.mockResolvedValue()

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({access_token: 'access-token'}), {
        headers: {'Content-Type': 'application/json'},
        status: 200,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        authEventId: 'auth-event-id',
        id: 'connection-id',
        tenantId: 'tenant-id',
        tenantName: 'Demo Company',
        tenantType: 'ORGANISATION',
      }]), {
        headers: {'Content-Type': 'application/json'},
        status: 200,
      })))
  })

  it('opens the authorization URL by default', async () => {
    await performLogin('client-id')

    expect(mocks.openBrowser).toHaveBeenCalledTimes(1)
    expect(mocks.openBrowser).toHaveBeenCalledWith(expect.stringMatching(
      /^https:\/\/login\.xero\.com\/identity\/connect\/authorize\?/,
    ))
  })

  it('returns the authorization URL without opening a browser in manual mode', async () => {
    const authorizationUrls: string[] = []

    await performLogin('client-id', undefined, {
      openBrowser: false,
      onAuthorizationUrl: (url: string) => authorizationUrls.push(url),
    })

    expect(mocks.openBrowser).not.toHaveBeenCalled()
    expect(authorizationUrls).toHaveLength(1)

    const authorizationUrl = new URL(authorizationUrls[0])
    expect(authorizationUrl.origin).toBe('https://login.xero.com')
    expect(authorizationUrl.pathname).toBe('/identity/connect/authorize')
    expect(authorizationUrl.searchParams.get('client_id')).toBe('client-id')
    expect(authorizationUrl.searchParams.get('redirect_uri')).toBe('http://localhost:8742/callback')
    expect(authorizationUrl.searchParams.get('state')).toBe('02020202020202020202020202020202')
  })
})
