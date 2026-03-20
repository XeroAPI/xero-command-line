import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatCurrency} from '../../lib/formatters.js'

export default class ReportsBalanceSheet extends BaseCommand {
  static override description = 'Generate a balance sheet report from Xero'

  static override examples = [
    '<%= config.bin %> reports balance-sheet',
    '<%= config.bin %> reports balance-sheet --date 2025-12-31',
    '<%= config.bin %> reports balance-sheet --timeframe QUARTER --periods 4',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    date: Flags.string({description: 'Report date (YYYY-MM-DD)'}),
    periods: Flags.integer({description: 'Number of periods to compare'}),
    timeframe: Flags.string({description: 'Timeframe', options: ['MONTH', 'QUARTER', 'YEAR']}),
    'payments-only': Flags.boolean({description: 'Include only accounts with payments', default: false}),
    'standard-layout': Flags.boolean({description: 'Use standard layout', default: false}),
    'tracking-option-id-1': Flags.string({description: 'Tracking option ID 1'}),
    'tracking-option-id-2': Flags.string({description: 'Tracking option ID 2'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ReportsBalanceSheet)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getReportBalanceSheet(
        tenantId,
        flags.date,
        flags.periods,
        flags.timeframe as 'MONTH' | 'QUARTER' | 'YEAR' | undefined,
        flags['tracking-option-id-1'],
        flags['tracking-option-id-2'],
        flags['payments-only'] || undefined,
        flags['standard-layout'] || undefined,
      )
      return response.body.reports?.[0]
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
      return
    }

    const report = result as Record<string, unknown> | undefined
    if (!report) {
      this.log('No report data returned.')
      return
    }

    this.log(`\n${report.reportName as string}`)
    this.log('')

    const rows = this.extractReportRows(report)
    this.outputFormatted(
      rows,
      [
        {key: 'account', header: 'Account'},
        {key: 'amount', header: 'Amount', format: (v) => v ? formatCurrency(v) : ''},
      ],
      {csv: flags.csv},
    )
  }

  private extractReportRows(report: Record<string, unknown>): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = []
    const sections = (report.rows ?? []) as Array<Record<string, unknown>>

    for (const section of sections) {
      if (section.title) {
        rows.push({account: `--- ${section.title} ---`, amount: ''})
      }
      const sectionRows = (section.rows ?? []) as Array<Record<string, unknown>>
      for (const row of sectionRows) {
        const cells = (row.cells ?? []) as Array<Record<string, unknown>>
        if (cells.length >= 2) {
          rows.push({
            account: cells[0]?.value,
            amount: cells[1]?.value,
          })
        }
      }
    }

    return rows
  }
}
