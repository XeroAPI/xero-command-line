import {createServer, type IncomingMessage, type ServerResponse} from 'node:http'
import {randomBytes, createHash} from 'node:crypto'
import {select} from '@inquirer/prompts'

const XERO_AUTH_BASE = 'https://login.xero.com/identity'
const XERO_TOKEN_BASE = 'https://identity.xero.com'
const REDIRECT_URI = 'http://localhost:8742/callback'
const CALLBACK_TIMEOUT_MS = 120_000

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  // Contacts & settings
  'accounting.contacts',
  'accounting.settings',
  // Granular transaction scopes
  'accounting.invoices',
  'accounting.payments',
  'accounting.banktransactions',
  'accounting.manualjournals',
  // Granular report scopes
  'accounting.reports.aged.read',
  'accounting.reports.balancesheet.read',
  'accounting.reports.profitandloss.read',
  'accounting.reports.trialbalance.read',
  // Other
  'accounting.budgets.read',
  'accounting.attachments',
].join(' ')

interface TokenSet {
  access_token: string
  refresh_token?: string
  expires_in?: number
  expires_at?: number
  id_token?: string
  token_type?: string
  scope?: string
}

interface XeroTenant {
  id: string
  authEventId: string
  tenantId: string
  tenantType: string
  tenantName: string
}

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

function buildAuthUrl(clientId: string, codeChallenge: string, state: string, scopes?: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: scopes ?? SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  })
  return `${XERO_AUTH_BASE}/connect/authorize?${params.toString()}`
}

function waitForCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close()
      reject(new Error('OAuth callback timed out after 2 minutes. Please try again.'))
    }, CALLBACK_TIMEOUT_MS)

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost:8742`)
      if (url.pathname !== '/callback') {
        res.writeHead(404)
        res.end('Not found')
        return
      }

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      const error = url.searchParams.get('error')

      if (error) {
        const desc = url.searchParams.get('error_description') ?? error
        res.writeHead(200, {'Content-Type': 'text/html'})
        res.end(`<html><body><h1>Authentication Failed</h1><p>${desc}</p><p>You can close this window.</p></body></html>`)
        clearTimeout(timeout)
        server.close()
        reject(new Error(`OAuth error: ${desc}`))
        return
      }

      if (!code || state !== expectedState) {
        res.writeHead(400, {'Content-Type': 'text/html'})
        res.end('<html><body><h1>Invalid Request</h1><p>Missing code or state mismatch.</p></body></html>')
        return
      }

      res.writeHead(200, {'Content-Type': 'text/html'})
      res.end('<html><body><h1>Success!</h1><p>You are now logged in. You can close this window.</p></body></html>')
      clearTimeout(timeout)
      server.close()
      resolve(code)
    })

    server.listen(8742, '127.0.0.1', () => {
      // Server ready
    })

    server.on('error', (err) => {
      clearTimeout(timeout)
      if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
        reject(new Error('Port 8742 is already in use. Close any other login attempts and try again.'))
      } else {
        reject(err)
      }
    })
  })
}

async function exchangeCodeForTokens(clientId: string, code: string, codeVerifier: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  })

  const response = await fetch(`${XERO_TOKEN_BASE}/connect/token`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token exchange failed (${response.status}): ${text}`)
  }

  return response.json() as Promise<TokenSet>
}

async function fetchTenants(accessToken: string): Promise<XeroTenant[]> {
  const response = await fetch('https://api.xero.com/connections', {
    headers: {Authorization: `Bearer ${accessToken}`},
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Xero tenants (${response.status})`)
  }

  return response.json() as Promise<XeroTenant[]>
}

export async function performLogin(
  clientId: string,
  scopes?: string,
): Promise<{tokenSet: TokenSet; tenantId: string; tenantName: string}> {
  const {default: open} = await import('open')

  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = randomBytes(16).toString('hex')

  const authUrl = buildAuthUrl(clientId, codeChallenge, state, scopes)

  // Start the callback server before opening the browser
  const codePromise = waitForCallback(state)
  await open(authUrl)

  const code = await codePromise
  const tokenSet = await exchangeCodeForTokens(clientId, code, codeVerifier)

  // Resolve tenant
  const tenants = await fetchTenants(tokenSet.access_token)

  if (tenants.length === 0) {
    throw new Error('No Xero organisations found. Please connect at least one organisation to your app.')
  }

  let tenant: XeroTenant
  if (tenants.length === 1) {
    tenant = tenants[0]
  } else {
    const selected = await select({
      message: 'Select a Xero organisation:',
      choices: tenants.map((t) => ({name: t.tenantName, value: t.tenantId})),
    })
    tenant = tenants.find((t) => t.tenantId === selected)!
  }

  return {tokenSet, tenantId: tenant.tenantId, tenantName: tenant.tenantName}
}

export async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    refresh_token: refreshToken,
  })

  const response = await fetch(`${XERO_TOKEN_BASE}/connect/token`, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token refresh failed (${response.status}): ${text}`)
  }

  return response.json() as Promise<TokenSet>
}
