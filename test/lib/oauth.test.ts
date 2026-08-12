import {createServer} from 'node:http'
import {afterEach, describe, expect, it} from 'vitest'
import {parseOAuthCallback, waitForCallback} from '../../src/lib/oauth.js'

const servers: ReturnType<typeof createServer>[] = []

async function freePort(): Promise<number> {
  const server = createServer()
  servers.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP address')
  const { port } = address
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  return port
}

async function requestWhenReady(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return await fetch(url)
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
  }
  throw new Error('Callback listener did not start')
}

afterEach(async () => {
  await Promise.all(
    servers
      .filter((server) => server.listening)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  )
  servers.length = 0
})

describe('parseOAuthCallback', () => {
  it('rejects an error callback before using its provider-controlled text when state is wrong', () => {
    const url = new URL('http://localhost/callback?state=wrong&error=denied&error_description=untrusted')

    expect(parseOAuthCallback(url, 'expected')).toEqual({kind: 'invalid'})
  })

  it('accepts matching-state success and error callbacks', () => {
    expect(parseOAuthCallback(new URL('http://localhost/callback?state=expected&code=code'), 'expected')).toEqual({
      kind: 'success',
      code: 'code',
    })
    expect(parseOAuthCallback(new URL('http://localhost/callback?state=expected&error=denied'), 'expected')).toEqual({
      kind: 'error',
      description: 'denied',
    })
  })
})

describe('waitForCallback', () => {
  it('ignores wrong or missing state traffic and accepts a later valid callback', async () => {
    const port = await freePort()
    const result = waitForCallback('expected', { port, timeoutMs: 2_000 })

    expect((await requestWhenReady(`http://127.0.0.1:${port}/callback?state=wrong&code=bad`)).status).toBe(400)
    expect((await fetch(`http://127.0.0.1:${port}/callback?code=missing-state`)).status).toBe(400)
    expect((await fetch(`http://127.0.0.1:${port}/callback?state=expected&code=valid-code`)).status).toBe(200)
    await expect(result).resolves.toBe('valid-code')
  })

  it('keeps provider-controlled error text out of browser HTML', async () => {
    const port = await freePort()
    const result = waitForCallback('expected', { port, timeoutMs: 2_000 })
    const rejection = expect(result).rejects.toThrow(
      'OAuth error: </p><script>alert(1)</script> next-line',
    )
    const metacharacters = '</p><script>alert(1)</script>\r\nnext-line'
    const response = await requestWhenReady(
      `http://127.0.0.1:${port}/callback?state=expected&error=denied&error_description=${encodeURIComponent(metacharacters)}`,
    )
    const html = await response.text()

    expect(html).toContain('Authentication Failed')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('next-line')
    await rejection
  })

  it('times out and closes the listener', async () => {
    const port = await freePort()

    await expect(waitForCallback('expected', { port, timeoutMs: 20 })).rejects.toThrow('timed out')
    await expect(fetch(`http://127.0.0.1:${port}/callback`)).rejects.toThrow()
  })

  it('reports a callback port listen error', async () => {
    const occupied = createServer()
    servers.push(occupied)
    await new Promise<void>((resolve, reject) => {
      occupied.once('error', reject)
      occupied.listen(0, '127.0.0.1', resolve)
    })
    const address = occupied.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP address')

    await expect(waitForCallback('expected', { port: address.port, timeoutMs: 2_000 })).rejects.toThrow(
      'already in use',
    )
  })
})
