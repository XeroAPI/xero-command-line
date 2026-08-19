import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatCurrency} from '../../lib/formatters.js'

export default class ReportsProfitAndLoss extends BaseCommand {
  static override description = 'Generate a profit and loss report from Xero'

  static override examples = [
    '<%= config.bin %> reports profit-and-loss',
    '<%= config.bin %> reports profit-and-loss --from 2025-01-01 --to 2025-12-31',
    '<%= config.bin %> reports profit-and-loss --timeframe QUARTER --periods 4',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    from: Flags.string({description: 'Start date (YYYY-MM-DD)'}),
    to: Flags.string({description: 'End date (YYYY-MM-DD)'}),
    periods: Flags.integer({description: 'Number of periods to compare'}),
    timeframe: Flags.string({description: 'Timeframe', options: ['MONTH', 'QUARTER', 'YEAR']}),
    'payments-only': Flags.boolean({description: 'Include only accounts with payments', default: false}),
    'standard-layout': Flags.boolean({description: 'Use standard layout', default: false}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ReportsProfitAndLoss)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getReportProfitAndLoss(
        tenantId,
        flags.from,
        flags.to,
        flags.periods,
        flags.timeframe as 'MONTH' | 'QUARTER' | 'YEAR' | undefined,
        undefined, // tracking category ID
        undefined, // tracking option ID
        undefined, // tracking category ID 2
        undefined, // tracking option ID 2
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
        ...this.extractPeriodColumns(report, rows),
      ],
      {csv: flags.csv},
    )
  }

  private extractPeriodColumns(report: Record<string, unknown>, rows: Record<string, unknown>[]) {
    const reportRows = (report.rows ?? []) as Array<Record<string, unknown>>
    const header = reportRows.find(row => row.rowType === 'Header')
    const cells = (header?.cells ?? []) as Array<Record<string, unknown>>
    const periods = cells.slice(1)
    const columnCount = Math.max(periods.length, this.countPeriodColumns(rows), 1)

    return Array.from({length: columnCount}, (_, index) => ({
      key: `period${index}`,
      header: String(periods[index]?.value ?? (columnCount === 1 ? 'Amount' : `Period ${index + 1}`)),
      format: (v: unknown) => v ? formatCurrency(v) : '',
    }))
  }

  private countPeriodColumns(rows: Record<string, unknown>[]): number {
    let count = 0
    for (const row of rows) {
      while (`period${count}` in row) count++
    }
    return count
  }

  private extractReportRows(report: Record<string, unknown>): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = []
    const sections = (report.rows ?? []) as Array<Record<string, unknown>>

    for (const section of sections) {
      if (section.title) {
        rows.push({account: `--- ${section.title} ---`})
      }
      const sectionRows = (section.rows ?? []) as Array<Record<string, unknown>>
      for (const row of sectionRows) {
        const cells = (row.cells ?? []) as Array<Record<string, unknown>>
        if (cells.length >= 2) {
          const reportRow: Record<string, unknown> = {account: cells[0]?.value}
          cells.slice(1).forEach((cell, index) => {
            reportRow[`period${index}`] = cell?.value
          })
          rows.push(reportRow)
        }
      }
    }

    return rows
  }
}
