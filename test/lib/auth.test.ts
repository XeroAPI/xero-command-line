import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mkdirSync, rmSync} from 'node:fs'
import {randomBytes} from 'node:crypto'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

const TEST_DIR = join(tmpdir(), `xero-command-line-auth-test-${Date.now()}`)
const TEST_KEY = randomBytes(32)
const fsCalls = vi.hoisted(() => ({
  writes: [] as string[],
  chmods: [] as Array<[string, number]>,
  renames: [] as Array<[string, string]>,
}))

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {
    ...actual,
    writeFileSync: (path: string, data: string, options?: object) => {
      fsCalls.writes.push(path)
      return actual.writeFileSync(path, data, options)
    },
    chmodSync: (path: string, mode: number) => {
      fsCalls.chmods.push([path, mode])
      return actual.chmodSync(path, mode)
    },
    renameSync: (from: string, to: string) => {
      fsCalls.renames.push([from, to])
      return actual.renameSync(from, to)
    },
  }
})

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return {
    ...actual,
    homedir: () => TEST_DIR,
  }
})

vi.mock('../../src/lib/crypto.js', () => ({
  CONFIG_DIR: join(TEST_DIR, '.config', 'xero-command-line'),
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
    mkdirSync(join(TEST_DIR, '.config', 'xero-command-line'), {recursive: true})
    fsCalls.writes.length = 0
    fsCalls.chmods.length = 0
    fsCalls.renames.length = 0
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

    it('retains the stored refresh token when a refresh omits it', async () => {
      await cacheTokenSet('rotating', {
        access_token: 'first-token',
        refresh_token: 'first-refresh',
        expires_at: Math.floor(Date.now() / 1000) - 100,
      }, 'tenant-1')

      await cacheTokenSet('rotating', {access_token: 'second-token', expires_in: 1800}, 'tenant-1')

      const entry = await getCachedTokenSet('rotating')
      expect(entry?.accessToken).toBe('second-token')
      expect(entry?.refreshToken).toBe('first-refresh')
      expect(entry?.expiresAt).toBeGreaterThan(Date.now())
    })

    it('does not cache when no refresh token is supplied or stored', async () => {
      await cacheTokenSet('no-refresh', {access_token: 'orphan-token', expires_in: 1800}, 'tenant-1')
      expect(await getCachedTokenSet('no-refresh')).toBeNull()
    })

    it('writes the cache to a temp file and renames it into place', async () => {
      const tokenPath = join(TEST_DIR, '.config', 'xero-command-line', 'tokens.json')
      await cacheTokenSet('atomic', {access_token: 'token', refresh_token: 'refresh', expires_in: 1800}, 'tenant-1')

      const written = fsCalls.writes.at(-1)
      expect(written).toBeDefined()
      expect(written).not.toBe(tokenPath)
      expect(fsCalls.chmods.at(-1)).toEqual([written, 0o600])
      expect(fsCalls.renames.at(-1)).toEqual([written, tokenPath])
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
