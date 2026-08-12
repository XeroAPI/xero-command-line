import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {journalFileCreateSchema, formatZodError} from '../../lib/validators.js'
import {formatMutationPreview, manualJournalMutationSummary, runConfirmedMutation} from '../../lib/mutation-confirmation.js'
import type {ManualJournal} from 'xero-node'

export default class ManualJournalsCreate extends BaseCommand {
  static override description = 'Create a manual journal in Xero'

  static override examples = [
    '<%= config.bin %> manual-journals create --file journal.json',
    '<%= config.bin %> manual-journals create --file journal.json --dry-run',
    '<%= config.bin %> manual-journals create --file journal.json --confirm <confirmation>',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with journal data', required: true}),
    'dry-run': Flags.boolean({description: 'Preview without creating a manual journal', default: false}),
    confirm: Flags.string({description: 'Organisation- and payload-bound value returned by --dry-run'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ManualJournalsCreate)

    const fileData = this.readJsonFile(flags.file) as Record<string, unknown>

    const parsed = journalFileCreateSchema.safeParse(fileData)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const journal = parsed.data as unknown as ManualJournal
    const outcome = await this.xeroCall(flags, async (xero, tenantId) => runConfirmedMutation({
      operation: 'manual-journals.create',
      tenantId,
      payload: journal,
      proposed: manualJournalMutationSummary(journal as unknown as Record<string, unknown>),
      dryRun: flags['dry-run'],
      confirmation: flags.confirm,
      mutate: async () => {
        const response = await xero.accountingApi.createManualJournals(tenantId, {manualJournals: [journal]})
        return response.body.manualJournals?.[0]
      },
    }))

    if (!outcome.executed) {
      this.log(formatMutationPreview(outcome.preview, flags.json))
      return
    }

    const result = outcome.value

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Manual journal created: ${r?.manualJournalID}`)
    }
  }
}
