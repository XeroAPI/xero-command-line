import {randomBytes, createCipheriv, createDecipheriv} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
const KEYRING_SERVICE = 'xero-command-line'
const KEYRING_ACCOUNT = 'encryption-key'

/**
 * Get or create the AES-256 encryption key.
 * Primary: OS keychain. Fallback: none (throws).
 */
export async function getOrCreateKey(): Promise<Buffer> {
  // Try to read from keychain
  const existing = await tryKeyringGet()
  if (existing) {
    return Buffer.from(existing, 'base64')
  }

  // Generate new key
  const key = randomBytes(32)
  const stored = await tryKeyringSet(key.toString('base64'))
  if (!stored) {
    throw new Error(
      'OS keychain is unavailable. The keychain is required to securely store the encryption key for token storage.',
    )
  }

  return key
}

/**
 * Delete the encryption key from keychain.
 */
export async function deleteKey(): Promise<void> {
  await tryKeyringDelete()
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64-encoded string: iv + authTag + ciphertext
 */
export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv, {authTagLength: AUTH_TAG_LENGTH})

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // Pack: iv (12) + authTag (16) + ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted])
  return packed.toString('base64')
}

/**
 * Decrypt a base64-encoded AES-256-GCM ciphertext.
 */
export function decrypt(encoded: string, key: Buffer): string {
  const packed = Buffer.from(encoded, 'base64')

  const iv = packed.subarray(0, IV_LENGTH)
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const ciphertext = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv, {authTagLength: AUTH_TAG_LENGTH})
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf-8')
}

async function tryKeyringGet(): Promise<string | null> {
  try {
    const {Entry} = await import('@napi-rs/keyring')
    const entry = new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT)
    return entry.getPassword()
  } catch {
    return null
  }
}

async function tryKeyringSet(value: string): Promise<boolean> {
  try {
    const {Entry} = await import('@napi-rs/keyring')
    const entry = new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT)
    entry.setPassword(value)
    return true
  } catch {
    return false
  }
}

async function tryKeyringDelete(): Promise<void> {
  try {
    const {Entry} = await import('@napi-rs/keyring')
    const entry = new Entry(KEYRING_SERVICE, KEYRING_ACCOUNT)
    entry.deletePassword()
  } catch {
    // Keyring unavailable or key doesn't exist
  }
}
