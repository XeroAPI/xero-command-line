import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {itemCreateSchema, formatZodError} from '../../lib/validators.js'
import type {Item} from 'xero-node'

export default class ItemsCreate extends BaseCommand {
  static override description = 'Create an item in Xero'

  static override examples = [
    '<%= config.bin %> items create --code WIDGET --name "Widget" --sale-price 29.99',
    '<%= config.bin %> items create --file item.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with item data'}),
    code: Flags.string({description: 'Item code'}),
    name: Flags.string({description: 'Item name'}),
    description: Flags.string({description: 'Item description'}),
    'sale-price': Flags.string({description: 'Sales unit price'}),
    'purchase-price': Flags.string({description: 'Purchase unit price'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ItemsCreate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        code: flags.code,
        name: flags.name,
        description: flags.description,
        salesDetails: flags['sale-price'] ? {unitPrice: Number(flags['sale-price'])} : undefined,
        purchaseDetails: flags['purchase-price'] ? {unitPrice: Number(flags['purchase-price'])} : undefined,
      }
    }

    const parsed = itemCreateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const item: Item = {
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description,
        purchaseDescription: parsed.data.purchaseDescription,
        isTrackedAsInventory: parsed.data.isTrackedAsInventory,
        inventoryAssetAccountCode: parsed.data.inventoryAssetAccountCode,
        salesDetails: parsed.data.salesDetails as Item['salesDetails'],
        purchaseDetails: parsed.data.purchaseDetails as Item['purchaseDetails'],
      }

      const response = await xero.accountingApi.createItems(tenantId, {items: [item]})
      return response.body.items?.[0]
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Item created: ${r?.code} - ${r?.name} (${r?.itemID})`)
    }
  }
}
