import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatStatus, formatDate} from '../../lib/formatters.js'

export default class ManualJournalsList extends BaseCommand {
  static override description = 'List manual journals in Xero'

  static override examples = [
    '<%= config.bin %> manual-journals list',
    '<%= config.bin %> manual-journals list --manual-journal-id abc-123',
    '<%= config.bin %> manual-journals list --modified-after 2025-01-01',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'manual-journal-id': Flags.string({description: 'Get a specific manual journal'}),
    'modified-after': Flags.string({description: 'Filter journals modified after date (YYYY-MM-DD)'}),
    page: Flags.integer({description: 'Page number'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ManualJournalsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      if (flags['manual-journal-id']) {
        const response = await xero.accountingApi.getManualJournal(tenantId, flags['manual-journal-id'])
        const journal = response.body.manualJournals?.[0]
        return journal ? [journal] : []
      }
      const response = await xero.accountingApi.getManualJournals(
        tenantId,
        flags['modified-after'] ? new Date(flags['modified-after']) : undefined,
        undefined,
        undefined,
        flags.page,
      )
      return response.body.manualJournals ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'manualJournalID', header: 'ID'},
        {key: 'narration', header: 'Narration'},
        {key: 'date', header: 'Date', format: (v) => formatDate(v)},
        {key: 'status', header: 'Status', format: (v) => formatStatus(String(v ?? ''))},
      ],
      flags,
    )
  }
}
