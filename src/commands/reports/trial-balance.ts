import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatCurrency} from '../../lib/formatters.js'

export default class ReportsTrialBalance extends BaseCommand {
  static override description = 'Generate a trial balance report from Xero'

  static override examples = [
    '<%= config.bin %> reports trial-balance',
    '<%= config.bin %> reports trial-balance --date 2025-12-31',
    '<%= config.bin %> reports trial-balance --payments-only --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    date: Flags.string({description: 'Report date (YYYY-MM-DD)'}),
    'payments-only': Flags.boolean({description: 'Include only accounts with payments', default: false}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ReportsTrialBalance)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getReportTrialBalance(
        tenantId,
        flags.date,
        flags['payments-only'] || undefined,
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
    this.log(`${(report.reportDate as string) ?? ''}`)
    this.log('')

    const rows = this.extractReportRows(report)
    this.outputFormatted(
      rows,
      [
        {key: 'account', header: 'Account'},
        {key: 'debit', header: 'Debit', format: (v) => v ? formatCurrency(v) : ''},
        {key: 'credit', header: 'Credit', format: (v) => v ? formatCurrency(v) : ''},
      ],
      {csv: flags.csv},
    )
  }

  private extractReportRows(report: Record<string, unknown>): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = []
    const sections = (report.rows ?? []) as Array<Record<string, unknown>>

    for (const section of sections) {
      const sectionRows = (section.rows ?? []) as Array<Record<string, unknown>>
      for (const row of sectionRows) {
        const cells = (row.cells ?? []) as Array<Record<string, unknown>>
        if (cells.length >= 3) {
          rows.push({
            account: cells[0]?.value,
            debit: cells[1]?.value,
            credit: cells[2]?.value,
          })
        }
      }
    }

    return rows
  }
}
