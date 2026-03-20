import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {quoteUpdateSchema, formatZodError} from '../../lib/validators.js'
import type {Quote, LineItem} from 'xero-node'

export default class QuotesUpdate extends BaseCommand {
  static override description = 'Update a draft quote in Xero'

  static override examples = [
    '<%= config.bin %> quotes update --file quote-update.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with quote update data'}),
    'quote-id': Flags.string({description: 'Quote ID'}),
    'contact-id': Flags.string({description: 'Contact ID'}),
    title: Flags.string({description: 'Quote title'}),
    summary: Flags.string({description: 'Quote summary'}),
    terms: Flags.string({description: 'Quote terms'}),
    reference: Flags.string({description: 'Quote reference'}),
    date: Flags.string({description: 'Quote date (YYYY-MM-DD)'}),
    'expiry-date': Flags.string({description: 'Expiry date (YYYY-MM-DD)'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(QuotesUpdate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        quoteId: flags['quote-id'],
        contactId: flags['contact-id'],
        title: flags.title,
        summary: flags.summary,
        terms: flags.terms,
        reference: flags.reference,
        date: flags.date,
        expiryDate: flags['expiry-date'],
      }
    }

    const parsed = quoteUpdateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const quote: Quote = {
        quoteID: parsed.data.quoteId,
        contact: parsed.data.contactId ? {contactID: parsed.data.contactId} : undefined,
        title: parsed.data.title,
        summary: parsed.data.summary,
        terms: parsed.data.terms,
        reference: parsed.data.reference,
        date: parsed.data.date,
        expiryDate: parsed.data.expiryDate,
        quoteNumber: parsed.data.quoteNumber,
      }

      if (parsed.data.lineItems) {
        quote.lineItems = parsed.data.lineItems.map(li => ({
          description: li.description,
          quantity: li.quantity,
          unitAmount: li.unitAmount,
          accountCode: li.accountCode,
          taxType: li.taxType,
        })) as LineItem[]
      }

      const response = await xero.accountingApi.updateQuote(tenantId, parsed.data.quoteId, {quotes: [quote]})
      return response.body.quotes?.[0]
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Quote updated: ${r?.quoteNumber} (${r?.quoteID})`)
    }
  }
}
