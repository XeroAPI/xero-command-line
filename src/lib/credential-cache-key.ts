export interface CredentialSelector {
  profile?: string
  'client-id'?: string
}

/**
 * The cache key used by releases before inline credentials were scoped to a
 * client ID. It is deliberately never used for reads because it cannot be
 * safely associated with a particular client ID.
 */
export const LEGACY_INLINE_CACHE_KEY = '_inline'

const INLINE_CACHE_KEY_PREFIX = '_inline:'

export function getInlineCredentialCacheKey(clientId: string): string {
  return `${INLINE_CACHE_KEY_PREFIX}${clientId}`
}

/**
 * Resolve an explicitly supplied profile/client ID to the token-cache key.
 * Callers that support a default profile should fall back to it only when
 * this function returns undefined.
 */
export function resolveCredentialCacheKey(flags: CredentialSelector): string | undefined {
  if (flags.profile) return flags.profile
  if (flags['client-id']) return getInlineCredentialCacheKey(flags['client-id'])
  return undefined
}

export function isInlineCredentialSelector(flags: CredentialSelector): boolean {
  return !flags.profile && Boolean(flags['client-id'])
}

/**
 * A logout of an inline session also removes the ambiguous legacy key. A
 * previous `_inline` token has no client ID recorded with it, so it must not
 * be reused by a client-ID-scoped session.
 */
export function getCredentialCacheKeysToClear(
  flags: CredentialSelector,
  defaultProfile?: string,
): string[] {
  const cacheKey = resolveCredentialCacheKey(flags) ?? defaultProfile
  if (!cacheKey) return []

  return isInlineCredentialSelector(flags)
    ? [cacheKey, LEGACY_INLINE_CACHE_KEY]
    : [cacheKey]
}
