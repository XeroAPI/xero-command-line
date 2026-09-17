import {beforeEach, describe, expect, it, vi} from 'vitest'
import type {Config} from '@oclif/core'

const mocks = vi.hoisted(() => ({
  cacheTokenSet: vi.fn(),
  performLogin: vi.fn(async (
    _clientId: string,
    _scopes?: string,
    options?: {openBrowser?: boolean; onAuthorizationUrl?: (url: string) => void},
  ) => {
    if (options?.openBrowser === false) {
      options.onAuthorizationUrl?.('https://login.xero.test/authorize')
    }

    return {
      tenantId: 'tenant-id',
      tenantName: 'Demo Company',
      tokenSet: {access_token: 'access-token'},
    }
  }),
}))

vi.mock('../../src/lib/auth.js', () => ({
  cacheTokenSet: mocks.cacheTokenSet,
}))

vi.mock('../../src/lib/oauth.js', () => ({
  performLogin: mocks.performLogin,
}))

const {default: Login} = await import('../../src/commands/login.js')

describe('login command', () => {
  beforeEach(() => {
    mocks.cacheTokenSet.mockClear()
    mocks.performLogin.mockClear()
    vi.restoreAllMocks()
  })

  it('prints an authorization URL instead of opening a browser with --no-open', async () => {
    const messages: string[] = []
    vi.spyOn(Login.prototype, 'log').mockImplementation((message = '') => messages.push(message))

    const command = new Login(
      ['--client-id', 'client-id', '--no-open'],
      {
        runHook: vi.fn(async () => ({successes: []})),
      } as unknown as Config,
    )
    const result = await command.run()
      .then(() => ({ok: true}), error => ({error, ok: false}))

    expect(result).toEqual({ok: true})
    expect(messages).toContain('Open this URL in a browser:')
    expect(messages).toContain('https://login.xero.test/authorize')
    expect(messages).not.toContain('Opening browser for Xero login...')
  })
})
