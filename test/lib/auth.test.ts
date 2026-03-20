import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import {mkdirSync, rmSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

const TEST_DIR = join(tmpdir(), `xero-cli-auth-test-${Date.now()}`)

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return {
    ...actual,
    homedir: () => TEST_DIR,
  }
})

const {getCachedToken, cacheTokenSet, clearCachedToken} = await import('../../src/lib/auth.js')

describe('auth token cache', () => {
  beforeEach(() => {
    mkdirSync(join(TEST_DIR, '.config', 'xero-cli'), {recursive: true})
  })

  afterEach(() => {
    rmSync(TEST_DIR, {recursive: true, force: true})
  })

  describe('getCachedToken', () => {
    it('returns null when no token cached', () => {
      expect(getCachedToken('no-profile')).toBeNull()
    })

    it('returns cached token when valid', () => {
      cacheTokenSet('test', {access_token: 'my-token', expires_in: 1800})
      expect(getCachedToken('test')).toBe('my-token')
    })

    it('returns null when token is expired', () => {
      cacheTokenSet('expired', {access_token: 'old-token', expires_at: Math.floor(Date.now() / 1000) - 100})
      expect(getCachedToken('expired')).toBeNull()
    })
  })

  describe('cacheTokenSet', () => {
    it('caches token with expires_in', () => {
      cacheTokenSet('profile-a', {access_token: 'token-a', expires_in: 1800})
      expect(getCachedToken('profile-a')).toBe('token-a')
    })

    it('caches token with expires_at', () => {
      const futureEpochSec = Math.floor(Date.now() / 1000) + 1800
      cacheTokenSet('profile-b', {access_token: 'token-b', expires_at: futureEpochSec})
      expect(getCachedToken('profile-b')).toBe('token-b')
    })

    it('does not cache if no access_token', () => {
      cacheTokenSet('empty', {})
      expect(getCachedToken('empty')).toBeNull()
    })
  })

  describe('clearCachedToken', () => {
    it('removes a cached token', () => {
      cacheTokenSet('to-clear', {access_token: 'remove-me', expires_in: 1800})
      expect(getCachedToken('to-clear')).toBe('remove-me')

      clearCachedToken('to-clear')
      expect(getCachedToken('to-clear')).toBeNull()
    })

    it('does not error when clearing non-existent profile', () => {
      expect(() => clearCachedToken('nonexistent')).not.toThrow()
    })
  })
})
