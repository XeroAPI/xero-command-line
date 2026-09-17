import {randomBytes} from 'node:crypto'
import {
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs'

const RENAME_RETRIES = 3
const LOCK_STALE_MS = 10_000
const LOCK_TIMEOUT_MS = 10_000

export class FileLockError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileLockError'
  }
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code
}

/** Synchronous sleep that does not depend on an event loop turn. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Write `contents` to `path` atomically: write to a unique temp file in the same
 * directory, fsync it, then rename over the target. Readers observe either the
 * old file or the new one, never a partially written file.
 */
export function writeFileAtomic(path: string, contents: string, mode = 0o600): void {
  const tmpPath = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`

  const fd = openSync(tmpPath, 'w', mode)
  try {
    writeSync(fd, contents)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }

  for (let attempt = 1; ; attempt++) {
    try {
      renameSync(tmpPath, path)
      return
    } catch (error) {
      const code = errorCode(error)
      // Windows can refuse to replace a file another process has open. Retry briefly.
      const retryable = code === 'EPERM' || code === 'EBUSY' || code === 'EACCES'
      if (!retryable || attempt >= RENAME_RETRIES) {
        rmSync(tmpPath, {force: true})
        throw error
      }
      sleepSync(20 * attempt)
    }
  }
}

/**
 * Run `fn` while holding a cross-process lock at `lockPath`.
 *
 * The lock is a directory: mkdir is atomic on every platform and fails with EEXIST
 * when another process already holds it. A lock older than LOCK_STALE_MS is assumed
 * to have been left behind by a crashed process and is removed.
 */
export async function withFileLock<T>(lockPath: string, fn: () => T | Promise<T>): Promise<T> {
  const start = Date.now()

  for (;;) {
    try {
      mkdirSync(lockPath)
      break
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') throw error

      if (isStaleLock(lockPath)) {
        rmSync(lockPath, {recursive: true, force: true})
        continue
      }

      if (Date.now() - start > LOCK_TIMEOUT_MS) {
        throw new FileLockError(
          `Timed out waiting for lock ${lockPath}. If no other xero process is running, remove it and retry.`,
        )
      }

      await sleep(10 + Math.floor(Math.random() * 40))
    }
  }

  try {
    return await fn()
  } finally {
    rmSync(lockPath, {recursive: true, force: true})
  }
}

function isStaleLock(lockPath: string): boolean {
  try {
    return Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS
  } catch {
    // Lock disappeared between mkdir and stat — not stale, just released.
    return false
  }
}
