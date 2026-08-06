import {BaseCommand} from '../../base-command.js'
import {formatCurrency} from '../../lib/formatters.js'

export default class ItemsList extends BaseCommand {
  static override description = 'List items in Xero'

  static override examples = [
    '<%= config.bin %> items list',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ItemsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getItems(tenantId)
      return response.body.items ?? []
    })

    this.outputFormatted(
      result as unknown as Record<string, unknown>[],
      [
        {key: 'itemID', header: 'ID'},
        {key: 'code', header: 'Code'},
        {key: 'name', header: 'Name'},
        {key: 'description', header: 'Description'},
        {key: 'salesDetails.unitPrice', header: 'Sale Price', format: (v) => formatCurrency(v)},
        {key: 'purchaseDetails.unitPrice', header: 'Purchase Price', format: (v) => formatCurrency(v)},
      ],
      flags,
    )
  }
}
