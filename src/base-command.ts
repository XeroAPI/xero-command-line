import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {Command, Flags} from '@oclif/core'
import {XeroClient} from 'xero-node'
import {getProfileClientId, getDefaultProfile} from './lib/profiles.js'
import {withRetry} from './lib/xero-client.js'
import {formatOutput, type OutputFormat} from './lib/formatters.js'

export abstract class BaseCommand extends Command {
  static baseFlags = {
    profile: Flags.string({
      char: 'p',
      description: 'Xero profile name',
      env: 'XERO_PROFILE',
    }),
    'client-id': Flags.string({
      description: 'Xero client ID (overrides profile)',
      env: 'XERO_CLIENT_ID',
    }),
    json: Flags.boolean({
      description: 'Output as JSON',
      default: false,
    }),
    csv: Flags.boolean({
      description: 'Output as CSV',
      default: false,
    }),
    toon: Flags.boolean({
      description: 'Output as TOON',
      default: false,
    }),
  }

  protected resolveCredentials(flags: {
    profile?: string
    'client-id'?: string
  }): {profileName: string; clientId: string} {
    // Priority 1: Explicit client-id flag
    if (flags['client-id']) {
      return {
        profileName: flags.profile ?? '_inline',
        clientId: flags['client-id'],
      }
    }

    // Priority 2: Named profile or default
    const profileName = flags.profile ?? getDefaultProfile()
    if (!profileName) {
      this.error('No profile configured. Run "xero profile add <name>" to set up a profile.')
    }

    const clientId = getProfileClientId(profileName)
    return {profileName, clientId}
  }

  protected async xeroCall<T>(
    flags: {profile?: string; 'client-id'?: string},
    operation: (xero: XeroClient, tenantId: string) => Promise<T>,
  ): Promise<T> {
    const {profileName, clientId} = this.resolveCredentials(flags)
    return withRetry(profileName, clientId, operation)
  }

  protected getOutputFormat(flags: {json?: boolean; csv?: boolean; toon?: boolean}): OutputFormat {
    if (flags.json) return 'json'
    if (flags.toon) return 'toon'
    if (flags.csv) return 'csv'
    return 'table'
  }

  protected outputFormatted(
    data: Record<string, unknown>[],
    columns: {key: string; header: string; format?: (value: unknown) => string}[],
    flags: {json?: boolean; csv?: boolean; toon?: boolean},
  ): void {
    const format = this.getOutputFormat(flags)
    this.log(formatOutput(data, columns, format))
  }

  protected async getOrgShortCode(xero: XeroClient, tenantId: string): Promise<string | undefined> {
    try {
      const response = await xero.accountingApi.getOrganisations(tenantId)
      const org = response.body.organisations?.[0]
      return (org as Record<string, unknown>)?.shortCode as string | undefined
    } catch {
      return undefined
    }
  }

  protected readJsonFile(filePath: string): unknown {
    try {
      const content = readFileSync(resolve(filePath), 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.error(`File not found: ${filePath}`)
      }
      if (error instanceof SyntaxError) {
        this.error(`Invalid JSON in file: ${filePath}`)
      }
      throw error
    }
  }
}
