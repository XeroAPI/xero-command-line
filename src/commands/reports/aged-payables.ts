import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatCurrency, formatDate} from '../../lib/formatters.js'

export default class ReportsAgedPayables extends BaseCommand {
  static override description = 'Generate aged payables report for a contact'

  static override examples = [
    '<%= config.bin %> reports aged-payables --contact-id abc-123',
    '<%= config.bin %> reports aged-payables --contact-id abc-123 --report-date 2025-12-31',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'contact-id': Flags.string({description: 'Contact ID', required: true}),
    'report-date': Flags.string({description: 'Report date (YYYY-MM-DD)'}),
    'from-date': Flags.string({description: 'Only show invoices after this date (YYYY-MM-DD)'}),
    'to-date': Flags.string({description: 'Only show invoices before this date (YYYY-MM-DD)'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ReportsAgedPayables)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getReportAgedPayablesByContact(
        tenantId,
        flags['contact-id'],
        flags['report-date'],
        flags['from-date'],
        flags['to-date'],
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
        {key: 'date', header: 'Date', format: (v) => formatDate(v)},
        {key: 'reference', header: 'Reference'},
        {key: 'due', header: 'Due', format: (v) => v ? formatCurrency(v) : ''},
        {key: 'paid', header: 'Paid', format: (v) => v ? formatCurrency(v) : ''},
        {key: 'credited', header: 'Credited', format: (v) => v ? formatCurrency(v) : ''},
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
        if (cells.length >= 5) {
          rows.push({
            date: cells[0]?.value,
            reference: cells[1]?.value,
            due: cells[2]?.value,
            paid: cells[3]?.value,
            credited: cells[4]?.value,
          })
        }
      }
    }

    return rows
  }
}
