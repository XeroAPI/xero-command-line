/**
 * Child-process worker for the token cache concurrency test.
 * Usage: node --loader ts-node/esm token-cache-worker.ts <profileName> <iterations>
 * Expects HOME to point at a temp dir and XERO_KEY_STORAGE=file with a pre-seeded key.
 */
import {cacheTokenSet} from '../../src/lib/auth.js'

const [profileName, iterationsArg] = process.argv.slice(2)
const iterations = Number(iterationsArg ?? '20')

for (let i = 0; i < iterations; i++) {
  await cacheTokenSet(
    profileName,
    {access_token: `access-${profileName}-${i}`, refresh_token: `refresh-${profileName}-${i}`, expires_in: 1800},
    `tenant-${profileName}`,
    `Org ${profileName}`,
  )
}
