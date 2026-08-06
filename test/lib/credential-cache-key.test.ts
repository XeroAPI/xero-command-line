import {describe, expect, it} from 'vitest'
import {
  LEGACY_INLINE_CACHE_KEY,
  getCredentialCacheKeysToClear,
  getInlineCredentialCacheKey,
  resolveCredentialCacheKey,
} from '../../src/lib/credential-cache-key.js'

describe('credential cache keys', () => {
  it('scopes inline credentials to their client ID', () => {
    const firstKey = resolveCredentialCacheKey({'client-id': 'client-a'})
    const secondKey = resolveCredentialCacheKey({'client-id': 'client-b'})

    expect(firstKey).toBe(getInlineCredentialCacheKey('client-a'))
    expect(secondKey).toBe(getInlineCredentialCacheKey('client-b'))
    expect(firstKey).not.toBe(secondKey)
    expect(firstKey).not.toBe(LEGACY_INLINE_CACHE_KEY)
  })

  it('preserves named-profile cache keys when a client ID overrides the profile configuration', () => {
    expect(resolveCredentialCacheKey({profile: 'acme', 'client-id': 'alternate-client'})).toBe('acme')
  })

  it('leaves default-profile selection to the caller when no selector is supplied', () => {
    expect(resolveCredentialCacheKey({})).toBeUndefined()
  })

  it('clears only the named/default profile cache key', () => {
    expect(getCredentialCacheKeysToClear({profile: 'acme'}, 'default')).toEqual(['acme'])
    expect(getCredentialCacheKeysToClear({}, 'default')).toEqual(['default'])
  })

  it('clears the scoped inline key and the ambiguous legacy inline key on logout', () => {
    expect(getCredentialCacheKeysToClear({'client-id': 'client-a'})).toEqual([
      getInlineCredentialCacheKey('client-a'),
      LEGACY_INLINE_CACHE_KEY,
    ])
  })
})
