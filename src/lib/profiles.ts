import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {homedir} from 'node:os'
import {join} from 'node:path'

export interface Profile {
  name: string
  clientId: string
}

interface ConfigFile {
  defaultProfile?: string
  profiles: Record<string, {clientId: string}>
}

const CONFIG_DIR = join(homedir(), '.config', 'xero-cli')
const CONFIG_PATH = join(CONFIG_DIR, 'config.json')

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, {recursive: true})
  }
}

function readConfig(): ConfigFile {
  ensureConfigDir()
  if (!existsSync(CONFIG_PATH)) {
    return {profiles: {}}
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8')) as ConfigFile
}

function writeConfig(config: ConfigFile): void {
  ensureConfigDir()
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export function addProfile(name: string, clientId: string): void {
  const config = readConfig()
  config.profiles[name] = {clientId}

  // Set as default if it's the first profile
  if (!config.defaultProfile) {
    config.defaultProfile = name
  }

  writeConfig(config)
}

export function removeProfile(name: string): void {
  const config = readConfig()
  delete config.profiles[name]

  if (config.defaultProfile === name) {
    const remaining = Object.keys(config.profiles)
    config.defaultProfile = remaining.length > 0 ? remaining[0] : undefined
  }

  writeConfig(config)
}

export function listProfiles(): {profiles: Profile[]; defaultProfile?: string} {
  const config = readConfig()
  const profiles = Object.entries(config.profiles).map(([name, data]) => ({
    name,
    clientId: data.clientId,
  }))
  return {profiles, defaultProfile: config.defaultProfile}
}

export function setDefaultProfile(name: string): void {
  const config = readConfig()
  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" not found. Run "xero profile add ${name}" first.`)
  }
  config.defaultProfile = name
  writeConfig(config)
}

export function getDefaultProfile(): string | undefined {
  const config = readConfig()
  return config.defaultProfile
}

export function getProfileClientId(name: string): string {
  const config = readConfig()
  const profile = config.profiles[name]
  if (!profile) {
    throw new Error(`Profile "${name}" not found. Run "xero profile list" to see available profiles.`)
  }

  return profile.clientId
}

export function profileExists(name: string): boolean {
  const config = readConfig()
  return name in config.profiles
}
