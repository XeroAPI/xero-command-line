import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {invoiceCreateSchema, formatZodError} from '../../lib/validators.js'
import {invoiceDeepLink, billDeepLink} from '../../lib/deeplinks.js'
import {Invoice} from 'xero-node'
import type {LineItem} from 'xero-node'

export default class InvoicesCreate extends BaseCommand {
  static override description = 'Create an invoice in Xero'

  static override examples = [
    '<%= config.bin %> invoices create --file invoice.json',
    '<%= config.bin %> invoices create --contact-id abc-123 --type ACCREC --description "Consulting" --quantity 10 --unit-amount 150 --account-code 200 --tax-type OUTPUT2',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with invoice data'}),
    'contact-id': Flags.string({description: 'Contact ID'}),
    type: Flags.string({description: 'Invoice type (ACCREC or ACCPAY)', options: ['ACCREC', 'ACCPAY']}),
    description: Flags.string({description: 'Line item description'}),
    quantity: Flags.string({description: 'Line item quantity'}),
    'unit-amount': Flags.string({description: 'Line item unit amount'}),
    'account-code': Flags.string({description: 'Line item account code'}),
    'tax-type': Flags.string({description: 'Line item tax type'}),
    'item-code': Flags.string({description: 'Line item code'}),
    date: Flags.string({description: 'Invoice date (YYYY-MM-DD)'}),
    reference: Flags.string({description: 'Invoice reference'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(InvoicesCreate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        contactId: flags['contact-id'],
        type: flags.type,
        date: flags.date,
        reference: flags.reference,
        lineItems: [{
          description: flags.description,
          quantity: flags.quantity ? Number(flags.quantity) : undefined,
          unitAmount: flags['unit-amount'] ? Number(flags['unit-amount']) : undefined,
          accountCode: flags['account-code'],
          taxType: flags['tax-type'],
          itemCode: flags['item-code'],
        }],
      }
    }

    const parsed = invoiceCreateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const {resource: result, shortCode} = await this.xeroCall(flags, async (xero, tenantId) => {
      const lineItems: LineItem[] = parsed.data.lineItems.map(li => ({
        description: li.description,
        quantity: li.quantity,
        unitAmount: li.unitAmount,
        accountCode: li.accountCode,
        taxType: li.taxType,
        itemCode: li.itemCode,
        tracking: li.tracking as LineItem['tracking'],
      }))

      const invoice: Invoice = {
        type: Invoice.TypeEnum[parsed.data.type as keyof typeof Invoice.TypeEnum],
        contact: {contactID: parsed.data.contactId},
        lineItems,
        date: parsed.data.date,
        reference: parsed.data.reference,
      }

      const response = await xero.accountingApi.createInvoices(tenantId, {invoices: [invoice]})
      const shortCode = await this.getOrgShortCode(xero, tenantId)
      return {resource: response.body.invoices?.[0], shortCode}
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Invoice created: ${r?.invoiceNumber} (${r?.invoiceID})`)
      if (shortCode && r?.invoiceID) {
        const link = parsed.data.type === 'ACCPAY'
          ? billDeepLink(shortCode, r.invoiceID as string)
          : invoiceDeepLink(shortCode, r.invoiceID as string)
        this.log(`View in Xero: ${link}`)
      }
    }
  }
}
