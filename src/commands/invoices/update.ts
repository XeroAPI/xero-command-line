import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {invoiceUpdateSchema, formatZodError} from '../../lib/validators.js'
import type {Invoice, LineItem} from 'xero-node'

export default class InvoicesUpdate extends BaseCommand {
  static override description = 'Update a draft invoice in Xero'

  static override examples = [
    '<%= config.bin %> invoices update --file invoice-update.json',
    '<%= config.bin %> invoices update --invoice-id abc-123 --reference "Updated ref"',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with invoice update data'}),
    'invoice-id': Flags.string({description: 'Invoice ID'}),
    'contact-id': Flags.string({description: 'Contact ID'}),
    date: Flags.string({description: 'Invoice date (YYYY-MM-DD)'}),
    'due-date': Flags.string({description: 'Due date (YYYY-MM-DD)'}),
    reference: Flags.string({description: 'Invoice reference'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(InvoicesUpdate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        invoiceId: flags['invoice-id'],
        contactId: flags['contact-id'],
        date: flags.date,
        dueDate: flags['due-date'],
        reference: flags.reference,
      }
    }

    const parsed = invoiceUpdateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const invoice: Invoice = {
        invoiceID: parsed.data.invoiceId,
        contact: parsed.data.contactId ? {contactID: parsed.data.contactId} : undefined,
        date: parsed.data.date,
        dueDate: parsed.data.dueDate,
        reference: parsed.data.reference,
      }

      if (parsed.data.lineItems) {
        invoice.lineItems = parsed.data.lineItems.map(li => ({
          description: li.description,
          quantity: li.quantity,
          unitAmount: li.unitAmount,
          accountCode: li.accountCode,
          taxType: li.taxType,
          itemCode: li.itemCode,
          tracking: li.tracking as LineItem['tracking'],
        }))
      }

      const response = await xero.accountingApi.updateInvoice(tenantId, parsed.data.invoiceId, {invoices: [invoice]})
      return response.body.invoices?.[0]
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Invoice updated: ${r?.invoiceNumber} (${r?.invoiceID})`)
    }
  }
}
