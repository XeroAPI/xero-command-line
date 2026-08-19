import {afterEach, describe, expect, it, vi} from 'vitest'
import {
  OAuthTokenRefreshError,
  isInvalidRefreshTokenError,
  refreshAccessToken,
} from '../../src/lib/oauth.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('refreshAccessToken success responses', () => {
  it('returns the rotated refresh token and drops unknown fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'new-access-token',
      refresh_token: 'rotated-refresh-token',
      expires_in: 1800,
      token_type: 'Bearer',
      scope: 'accounting.transactions',
      unexpected_field: 'ignored',
    }), {status: 200})))

    await expect(refreshAccessToken('client-id', 'refresh-token')).resolves.toEqual({
      access_token: 'new-access-token',
      refresh_token: 'rotated-refresh-token',
      expires_in: 1800,
      token_type: 'Bearer',
      scope: 'accounting.transactions',
    })
  })

  it('returns a successful refresh that omits the refresh token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'new-access-token',
      expires_in: 1800,
    }), {status: 200})))

    await expect(refreshAccessToken('client-id', 'refresh-token')).resolves.toEqual({
      access_token: 'new-access-token',
      expires_in: 1800,
    })
  })
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
    expect('oauthErrorDescription' in (error as object)).toBe(false)
    expect(String(error)).not.toContain('invalid or has expired')
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
    const transportError = new TypeError('fetch failed with SYNTHETIC-SECRET')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(transportError))

    const error = await refreshAccessToken('client-id', 'refresh-token').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('Token refresh request failed.')
    expect((error as Error).message).not.toContain('SYNTHETIC-SECRET')
    expect(isInvalidRefreshTokenError(error)).toBe(false)
  })

  it('sets a fail-closed redirect policy and timeout', async () => {
    const redirectTarget = vi.fn()
    const fetchMock = vi.fn().mockImplementation(async (_url: string, options: RequestInit) => {
      if (options.redirect !== 'error') return redirectTarget()
      throw new TypeError('redirect rejected')
    })
    const signal = new AbortController().signal
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(signal)
    vi.stubGlobal('fetch', fetchMock)

    await expect(refreshAccessToken('client-id', 'refresh-token')).rejects.toThrow('Token refresh request failed.')

    expect(timeout).toHaveBeenCalledWith(10_000)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      redirect: 'error',
      signal,
    })
    expect(redirectTarget).not.toHaveBeenCalled()
  })

  it('bounds token endpoint requests with a non-reflective timeout', async () => {
    const secret = 'SYNTHETIC-TIMEOUT-SECRET'
    const controller = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      queueMicrotask(() => controller.abort())
      return controller.signal
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => reject(new Error(secret)))
          }),
      ),
    )

    const error = await refreshAccessToken('client-id', 'refresh-token').catch((caught: unknown) => caught)
    expect((error as Error).message).toBe('Token refresh request timed out.')
    expect((error as Error).message).not.toContain(secret)
  })

  it('rejects oversized and malformed success bodies without reflection', async () => {
    const secret = 'SYNTHETIC-OVERSIZED-TOKEN'
    let cancelled = false
    const oversizedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(secret.repeat(10_000)))
      },
      cancel() {
        cancelled = true
      },
    })
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(oversizedBody, {status: 200}))
        .mockResolvedValueOnce(new Response(`{"access_token": "${secret}`, {status: 200})),
    )

    const oversized = await refreshAccessToken('client-id', 'refresh-token').catch((caught: unknown) => caught)
    const malformed = await refreshAccessToken('client-id', 'refresh-token').catch((caught: unknown) => caught)

    expect((oversized as Error).message).toContain('exceeded the safety limit')
    expect((malformed as Error).message).toContain('invalid response')
    expect((oversized as Error).message).not.toContain(secret)
    expect((malformed as Error).message).not.toContain(secret)
    expect(cancelled).toBe(true)
  })
})
