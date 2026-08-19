import {describe, expect, it} from 'vitest'
import {
  LEGACY_INLINE_CACHE_KEY,
  getCredentialCacheKeysToClear,
  getInlineCredentialCacheKey,
  getOverriddenProfileCacheKey,
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

  it('scopes a named profile to the client ID that overrides its configuration', () => {
    expect(resolveCredentialCacheKey({profile: 'acme', 'client-id': 'alternate-client'})).toBe(
      getOverriddenProfileCacheKey('acme', 'alternate-client'),
    )
    expect(resolveCredentialCacheKey({profile: 'acme'})).toBe('acme')
  })

  it('never shares one cache key between two client IDs on the same profile', () => {
    const withClientA = resolveCredentialCacheKey({profile: 'acme', 'client-id': 'client-a'})
    const withClientB = resolveCredentialCacheKey({profile: 'acme', 'client-id': 'client-b'})

    expect(withClientA).not.toBe(withClientB)
    expect(withClientA).not.toBe('acme')
    expect(withClientB).not.toBe('acme')
  })

  it('leaves default-profile selection to the caller when no selector is supplied', () => {
    expect(resolveCredentialCacheKey({})).toBeUndefined()
  })

  it('clears the named/default profile cache key alongside the legacy inline key', () => {
    expect(getCredentialCacheKeysToClear({profile: 'acme'}, 'default')).toEqual([
      'acme',
      LEGACY_INLINE_CACHE_KEY,
    ])
    expect(getCredentialCacheKeysToClear({}, 'default')).toEqual(['default', LEGACY_INLINE_CACHE_KEY])
  })

  it('clears the scoped inline key and the ambiguous legacy inline key on logout', () => {
    expect(getCredentialCacheKeysToClear({'client-id': 'client-a'})).toEqual([
      getInlineCredentialCacheKey('client-a'),
      LEGACY_INLINE_CACHE_KEY,
    ])
  })
})
