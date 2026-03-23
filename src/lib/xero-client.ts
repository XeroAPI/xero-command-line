import {XeroClient} from 'xero-node'
import {getCachedTokenSet, cacheTokenSet, clearCachedToken, isTokenExpired} from './auth.js'
import {refreshAccessToken} from './oauth.js'

export {clearCachedToken}

export async function createXeroClient(
  profileName: string,
  clientId: string,
): Promise<{xero: XeroClient; tenantId: string}> {
  const cached = await getCachedTokenSet(profileName)
  if (!cached) {
    throw new Error(`Not logged in. Run "xero login" to authenticate.`)
  }

  let accessToken = cached.accessToken
  const tenantId = cached.tenantId

  // If token is expired, try to refresh
  if (isTokenExpired(cached)) {
    try {
      const newTokenSet = await refreshAccessToken(clientId, cached.refreshToken)
      await cacheTokenSet(profileName, newTokenSet, cached.tenantId, cached.tenantName)
      accessToken = newTokenSet.access_token
    } catch {
      clearCachedToken(profileName)
      throw new Error(`Session expired. Run "xero login" to re-authenticate.`)
    }
  }

  const xero = new XeroClient({clientId, clientSecret: ''})
  xero.setTokenSet({access_token: accessToken})

  return {xero, tenantId}
}

export async function withRetry<T>(
  profileName: string,
  clientId: string,
  operation: (xero: XeroClient, tenantId: string) => Promise<T>,
  maxRetries = 2,
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const {xero, tenantId} = await createXeroClient(profileName, clientId)
      return await operation(xero, tenantId)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Handle 401: try refreshing token
      if (lastError.message.includes('401') && attempt < maxRetries) {
        const cached = await getCachedTokenSet(profileName)
        if (cached?.refreshToken) {
          try {
            const newTokenSet = await refreshAccessToken(clientId, cached.refreshToken)
            await cacheTokenSet(profileName, newTokenSet, cached.tenantId, cached.tenantName)
            continue
          } catch {
            clearCachedToken(profileName)
            throw new Error(`Session expired. Run "xero login" to re-authenticate.`)
          }
        }
        clearCachedToken(profileName)
        continue
      }

      // Handle rate limit
      if (lastError.message.includes('429')) {
        const retryAfter = extractRetryAfter(lastError.message)
        throw new Error(`Rate limited. Retry after ${retryAfter} seconds.`)
      }

      // Handle 404
      if (lastError.message.includes('404')) {
        throw new Error('Resource not found.')
      }

      throw sanitizeApiError(lastError)
    }
  }

  throw lastError ? sanitizeApiError(lastError) : new Error('Operation failed after retries')
}

function sanitizeApiError(error: Error): Error {
  try {
    const err = error as unknown as Record<string, unknown>
    const response = err.response as Record<string, unknown> | undefined
    const body = response?.body as Record<string, unknown> | undefined

    // Extract Xero validation messages if available
    if (body) {
      const statusCode = response?.statusCode ?? response?.status ?? ''
      const elements = body.Elements as Array<Record<string, unknown>> | undefined
      if (elements?.length) {
        const messages = elements
          .flatMap(el => (el.ValidationErrors as Array<{Message: string}>) ?? [])
          .map(ve => ve.Message)
          .filter(Boolean)
        if (messages.length) {
          return new Error(`Xero API error${statusCode ? ` (${statusCode})` : ''}: ${messages.join('; ')}`)
        }
      }

      // Try top-level message from body
      if (body.Message || body.message) {
        return new Error(`Xero API error${statusCode ? ` (${statusCode})` : ''}: ${body.Message ?? body.message}`)
      }
    }
  } catch {
    // Fall through to returning the message-only error
  }

  // Fallback: only propagate the message string, never the full error object
  return new Error(error.message)
}

function extractRetryAfter(message: string): number {
  const match = /retry-after:\s*(\d+)/i.exec(message)
  return match ? Number(match[1]) : 60
}
