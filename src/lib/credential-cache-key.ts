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
const OVERRIDE_CACHE_KEY_PREFIX = '_override:'

export function getInlineCredentialCacheKey(clientId: string): string {
  return `${INLINE_CACHE_KEY_PREFIX}${clientId}`
}

/**
 * A client ID supplied alongside a profile overrides the profile's own client
 * ID, so the session belongs to a different OAuth client and must not share the
 * profile's cache entry. The client ID comes first because it cannot contain a
 * colon, which keeps the key unambiguous for any profile name.
 */
export function getOverriddenProfileCacheKey(profile: string, clientId: string): string {
  return `${OVERRIDE_CACHE_KEY_PREFIX}${clientId}:${profile}`
}

/**
 * Resolve an explicitly supplied profile/client ID to the token-cache key.
 * Callers that support a default profile should fall back to it only when
 * this function returns undefined.
 */
export function resolveCredentialCacheKey(flags: CredentialSelector): string | undefined {
  const clientId = flags['client-id']
  if (flags.profile) {
    return clientId ? getOverriddenProfileCacheKey(flags.profile, clientId) : flags.profile
  }
  if (clientId) return getInlineCredentialCacheKey(clientId)
  return undefined
}

export function isInlineCredentialSelector(flags: CredentialSelector): boolean {
  return !flags.profile && Boolean(flags['client-id'])
}

/**
 * Every logout also removes the ambiguous legacy key. A previous `_inline`
 * token has no client ID recorded with it, so it can never be read again and
 * would otherwise stay a live refresh token in tokens.json with no command
 * able to remove it.
 */
export function getCredentialCacheKeysToClear(
  flags: CredentialSelector,
  defaultProfile?: string,
): string[] {
  const cacheKey = resolveCredentialCacheKey(flags) ?? defaultProfile

  return cacheKey ? [cacheKey, LEGACY_INLINE_CACHE_KEY] : [LEGACY_INLINE_CACHE_KEY]
}
