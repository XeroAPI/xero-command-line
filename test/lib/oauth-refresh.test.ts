import {afterEach, describe, expect, it, vi} from 'vitest'
import {
  OAuthTokenRefreshError,
  isInvalidRefreshTokenError,
  refreshAccessToken,
} from '../../src/lib/oauth.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('refreshAccessToken error classification', () => {
  it('classifies a structured invalid_grant response as an unusable refresh token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'The refresh token is invalid or has expired.',
    }), {status: 400})))

    let error: unknown
    try {
      await refreshAccessToken('client-id', 'refresh-token')
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(OAuthTokenRefreshError)
    expect((error as OAuthTokenRefreshError).statusCode).toBe(400)
    expect((error as OAuthTokenRefreshError).oauthError).toBe('invalid_grant')
    expect(isInvalidRefreshTokenError(error)).toBe(true)
  })

  it('keeps a 5xx token-endpoint failure retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('temporarily unavailable', {status: 503})))

    let error: unknown
    try {
      await refreshAccessToken('client-id', 'refresh-token')
    } catch (caught) {
      error = caught
    }

    expect(error).toBeInstanceOf(OAuthTokenRefreshError)
    expect(isInvalidRefreshTokenError(error)).toBe(false)
  })

  it('does not treat an invalid_grant payload from a 5xx response as confirmed', () => {
    expect(isInvalidRefreshTokenError(new OAuthTokenRefreshError(503, 'invalid_grant'))).toBe(false)
  })

  it('keeps a transport failure retryable', async () => {
    const transportError = new TypeError('fetch failed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(transportError))

    await expect(refreshAccessToken('client-id', 'refresh-token')).rejects.toBe(transportError)
    expect(isInvalidRefreshTokenError(transportError)).toBe(false)
  })
})
