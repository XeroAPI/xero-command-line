import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {journalFileCreateSchema, formatZodError} from '../../lib/validators.js'
import type {ManualJournal} from 'xero-node'

export default class ManualJournalsCreate extends BaseCommand {
  static override description = 'Create a manual journal in Xero'

  static override examples = [
    '<%= config.bin %> manual-journals create --file journal.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with journal data', required: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ManualJournalsCreate)

    const fileData = this.readJsonFile(flags.file) as Record<string, unknown>

    const parsed = journalFileCreateSchema.safeParse(fileData)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.createManualJournals(tenantId, {manualJournals: [fileData as unknown as ManualJournal]})
      return response.body.manualJournals?.[0]
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Manual journal created: ${r?.manualJournalID}`)
    }
  }
}
