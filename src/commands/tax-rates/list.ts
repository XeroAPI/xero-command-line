import {BaseCommand} from '../../base-command.js'
import {formatStatus} from '../../lib/formatters.js'

export default class TaxRatesList extends BaseCommand {
  static override description = 'List tax rates in Xero'

  static override examples = [
    '<%= config.bin %> tax-rates list',
    '<%= config.bin %> tax-rates list --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(TaxRatesList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getTaxRates(tenantId)
      return response.body.taxRates ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'name', header: 'Name'},
        {key: 'taxType', header: 'Tax Type'},
        {key: 'effectiveRate', header: 'Rate (%)'},
        {key: 'status', header: 'Status', format: (v) => formatStatus(String(v ?? ''))},
      ],
      flags,
    )
  }
}
