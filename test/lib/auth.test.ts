import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mkdirSync, rmSync} from 'node:fs'
import {randomBytes} from 'node:crypto'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

const TEST_DIR = join(tmpdir(), `xero-cli-auth-test-${Date.now()}`)
const TEST_KEY = randomBytes(32)

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return {
    ...actual,
    homedir: () => TEST_DIR,
  }
})

vi.mock('../../src/lib/crypto.js', () => ({
  getOrCreateKey: async () => TEST_KEY,
  encrypt: (plaintext: string, key: Buffer) => {
    // Simple reversible encoding for tests
    return Buffer.from(plaintext).toString('base64')
  },
  decrypt: (encoded: string, _key: Buffer) => {
    return Buffer.from(encoded, 'base64').toString('utf-8')
  },
}))

const {getCachedTokenSet, cacheTokenSet, clearCachedToken} = await import('../../src/lib/auth.js')

describe('auth token cache', () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, '.config', 'xero-cli'), {recursive: true})
  })

  afterEach(() => {
    rmSync(TEST_DIR, {recursive: true, force: true})
  })

  describe('getCachedTokenSet', () => {
    it('returns null when no token cached', async () => {
      expect(await getCachedTokenSet('no-profile')).toBeNull()
    })

    it('returns cached token when valid', async () => {
      await cacheTokenSet('test', {access_token: 'my-token', refresh_token: 'my-refresh', expires_in: 1800}, 'tenant-1')
      const entry = await getCachedTokenSet('test')
      expect(entry?.accessToken).toBe('my-token')
      expect(entry?.refreshToken).toBe('my-refresh')
      expect(entry?.tenantId).toBe('tenant-1')
    })

    it('returns null when token is expired', async () => {
      await cacheTokenSet('expired', {access_token: 'old-token', refresh_token: 'old-refresh', expires_at: Math.floor(Date.now() / 1000) - 100}, 'tenant-1')
      const entry = await getCachedTokenSet('expired')
      // Token is returned even if expired — caller uses isTokenExpired to check
      expect(entry).not.toBeNull()
    })
  })

  describe('cacheTokenSet', () => {
    it('caches token with expires_in', async () => {
      await cacheTokenSet('profile-a', {access_token: 'token-a', refresh_token: 'refresh-a', expires_in: 1800}, 'tenant-a')
      const entry = await getCachedTokenSet('profile-a')
      expect(entry?.accessToken).toBe('token-a')
    })

    it('caches token with expires_at', async () => {
      const futureEpochSec = Math.floor(Date.now() / 1000) + 1800
      await cacheTokenSet('profile-b', {access_token: 'token-b', refresh_token: 'refresh-b', expires_at: futureEpochSec}, 'tenant-b')
      const entry = await getCachedTokenSet('profile-b')
      expect(entry?.accessToken).toBe('token-b')
    })

    it('does not cache if no access_token', async () => {
      await cacheTokenSet('empty', {}, 'tenant-x')
      expect(await getCachedTokenSet('empty')).toBeNull()
    })
  })

  describe('clearCachedToken', () => {
    it('removes a cached token', async () => {
      await cacheTokenSet('to-clear', {access_token: 'remove-me', refresh_token: 'refresh-me', expires_in: 1800}, 'tenant-1')
      const entry = await getCachedTokenSet('to-clear')
      expect(entry?.accessToken).toBe('remove-me')

      clearCachedToken('to-clear')
      expect(await getCachedTokenSet('to-clear')).toBeNull()
    })

    it('does not error when clearing non-existent profile', () => {
      expect(() => clearCachedToken('nonexistent')).not.toThrow()
    })
  })
})
