import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {journalCreateSchema, formatZodError} from '../../lib/validators.js'
import type {ManualJournal, ManualJournalLine} from 'xero-node'

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

    const data = this.readJsonFile(flags.file) as Record<string, unknown>

    const parsed = journalCreateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const journalLines: ManualJournalLine[] = parsed.data.manualJournalLines.map(line => ({
        accountCode: line.accountCode,
        lineAmount: line.lineAmount,
        description: line.description,
        taxType: line.taxType,
      }))

      const journal: ManualJournal = {
        narration: parsed.data.narration,
        journalLines: journalLines,
        date: parsed.data.date,
        lineAmountTypes: parsed.data.lineAmountTypes as ManualJournal['lineAmountTypes'],
        status: parsed.data.status as ManualJournal['status'],
        url: parsed.data.url,
        showOnCashBasisReports: parsed.data.showOnCashBasisReports,
      }

      const response = await xero.accountingApi.createManualJournals(tenantId, {manualJournals: [journal]})
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
