import {describe, it, expect} from 'vitest'
import {parseXeroError, sanitizeApiError} from '../../src/lib/xero-client.js'

const BEARER = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFDQUY4RTY2NzcyRDZEQzAyOEQ2NzI2RkQwMjYxNTgxNTcwRUZDMTkifQ.payload.sig'
const SET_COOKIE = 'ak_bmsc=SECRETCOOKIE; Domain=.xero.com'

function leakAssertions(message: string): void {
  expect(message).not.toContain('Bearer')
  expect(message).not.toContain('authorization')
  expect(message).not.toContain(BEARER)
  expect(message).not.toContain('set-cookie')
  expect(message).not.toContain('ak_bmsc')
  expect(message).not.toContain('xero-correlation-id')
}

describe('sanitizeApiError', () => {
  it('extracts validation messages and strips bearer token + headers', () => {
    // Shape mirrors xero-node's ApiError.generateError(): top-level `body`
    // and `response.body` reference the same parsed payload.
    const body = {
      ErrorNumber: 10,
      Type: 'ValidationException',
      Message: 'A validation exception occurred',
      Elements: [
        {
          ContactID: '00000000-0000-0000-0000-000000000000',
          Name: 'City Agency',
          HasValidationErrors: true,
          ValidationErrors: [
            {
              Message:
                'The contact name City Agency is already assigned to another contact. The contact name must be unique across all active contacts.',
            },
          ],
        },
      ],
    }
    const apiError = {
      response: {
        statusCode: 400,
        body,
        headers: {
          'content-type': 'application/json',
          'set-cookie': SET_COOKIE,
          'xero-correlation-id': 'c5be1e31-b2d1-4fd2-a3bf-9514e3199343',
        },
        request: {
          url: {protocol: 'https:', host: 'api.xero.com', path: '/api.xro/2.0/Contacts'},
          headers: {authorization: `Bearer ${BEARER}`},
          method: 'PUT',
        },
      },
      body,
    }

    const result = sanitizeApiError(new Error(JSON.stringify(apiError)))

    expect(result.message).toBe(
      'Xero API error (400): The contact name City Agency is already assigned to another contact. The contact name must be unique across all active contacts.',
    )
    leakAssertions(result.message)
  })

  it('joins multiple validation messages with semicolons', () => {
    const apiError = {
      response: {
        statusCode: 400,
        body: {
          Elements: [
            {
              ValidationErrors: [
                {Message: 'Name is required.'},
                {Message: 'EmailAddress is invalid.'},
              ],
            },
          ],
        },
        headers: {authorization: `Bearer ${BEARER}`},
      },
    }

    const result = sanitizeApiError(new Error(JSON.stringify(apiError)))

    expect(result.message).toBe('Xero API error (400): Name is required.; EmailAddress is invalid.')
    leakAssertions(result.message)
  })

  it('falls back to body.Message when no Elements are present', () => {
    const apiError = {
      response: {
        statusCode: 403,
        body: {
          Message: 'AuthenticationUnsuccessful',
        },
        headers: {authorization: `Bearer ${BEARER}`},
      },
      body: {Message: 'AuthenticationUnsuccessful'},
    }

    const result = sanitizeApiError(new Error(JSON.stringify(apiError)))

    expect(result.message).toBe('Xero API error (403): AuthenticationUnsuccessful')
    leakAssertions(result.message)
  })

  it('handles errors with no body and just a status code', () => {
    const apiError = {
      response: {
        statusCode: 500,
        headers: {authorization: `Bearer ${BEARER}`},
      },
    }

    const result = sanitizeApiError(new Error(JSON.stringify(apiError)))

    expect(result.message).toBe('Xero API error (500)')
    leakAssertions(result.message)
  })

  it('passes through non-JSON error messages unchanged', () => {
    const original = new Error('Session expired. Run "xero login" to re-authenticate.')
    const result = sanitizeApiError(original)
    expect(result.message).toBe('Session expired. Run "xero login" to re-authenticate.')
  })

  it('passes through malformed JSON error messages unchanged', () => {
    const original = new Error('not json {')
    const result = sanitizeApiError(original)
    expect(result.message).toBe('not json {')
  })

  it('never leaks even if structure is unexpected', () => {
    // An object that starts with { but has none of our expected fields, and a hostile body.
    const weird = {
      response: {statusCode: 418, body: {weird: true}},
      authorization: `Bearer ${BEARER}`,
    }
    const result = sanitizeApiError(new Error(JSON.stringify(weird)))
    expect(result.message).toBe('Xero API error (418)')
    leakAssertions(result.message)
  })
})

describe('parseXeroError', () => {
  it('returns the parsed body and statusCode for JSON-stringified ApiError', () => {
    const err = new Error(JSON.stringify({response: {statusCode: 429}}))
    expect(parseXeroError(err)).toEqual({statusCode: 429, parsed: {response: {statusCode: 429}}})
  })

  it('reads statusCode from response.status when statusCode is absent', () => {
    const err = new Error(JSON.stringify({response: {status: 401}}))
    expect(parseXeroError(err).statusCode).toBe(401)
  })

  it('returns empty object for non-JSON messages', () => {
    expect(parseXeroError(new Error('Resource not found.'))).toEqual({})
  })

  it('returns empty object for malformed JSON', () => {
    expect(parseXeroError(new Error('{ not json'))).toEqual({})
  })

  it('returns parsed but undefined statusCode when response has no status', () => {
    const err = new Error(JSON.stringify({body: {Message: 'oops'}}))
    const result = parseXeroError(err)
    expect(result.statusCode).toBeUndefined()
    expect(result.parsed).toEqual({body: {Message: 'oops'}})
  })
})
