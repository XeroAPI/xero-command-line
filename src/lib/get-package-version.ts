import {readFileSync} from 'node:fs'
import {resolve, dirname} from 'node:path'
import {fileURLToPath} from 'node:url'

let cachedVersion: string | undefined

export function getPackageVersion(): string {
  if (cachedVersion) return cachedVersion

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const packageJsonPath = resolve(__dirname, '..', '..', 'package.json')
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  cachedVersion = packageJson.version as string

  return cachedVersion
}
