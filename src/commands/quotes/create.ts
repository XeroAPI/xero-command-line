import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {quoteCreateSchema, formatZodError} from '../../lib/validators.js'
import {quoteDeepLink} from '../../lib/deeplinks.js'
import type {Quote, LineItem} from 'xero-node'

export default class QuotesCreate extends BaseCommand {
  static override description = 'Create a quote in Xero'

  static override examples = [
    '<%= config.bin %> quotes create --file quote.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with quote data'}),
    'contact-id': Flags.string({description: 'Contact ID'}),
    title: Flags.string({description: 'Quote title'}),
    summary: Flags.string({description: 'Quote summary'}),
    terms: Flags.string({description: 'Quote terms'}),
    reference: Flags.string({description: 'Quote reference'}),
    description: Flags.string({description: 'Line item description'}),
    quantity: Flags.string({description: 'Line item quantity'}),
    'unit-amount': Flags.string({description: 'Line item unit amount'}),
    'account-code': Flags.string({description: 'Line item account code'}),
    'tax-type': Flags.string({description: 'Line item tax type'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(QuotesCreate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        contactId: flags['contact-id'],
        title: flags.title,
        summary: flags.summary,
        terms: flags.terms,
        reference: flags.reference,
        lineItems: [{
          description: flags.description,
          quantity: flags.quantity ? Number(flags.quantity) : undefined,
          unitAmount: flags['unit-amount'] ? Number(flags['unit-amount']) : undefined,
          accountCode: flags['account-code'],
          taxType: flags['tax-type'],
        }],
      }
    }

    const parsed = quoteCreateSchema.safeParse(data)
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
      }))

      const quote: Quote = {
        contact: {contactID: parsed.data.contactId},
        lineItems,
        title: parsed.data.title,
        summary: parsed.data.summary,
        terms: parsed.data.terms,
        reference: parsed.data.reference,
        quoteNumber: parsed.data.quoteNumber,
      }

      const response = await xero.accountingApi.createQuotes(tenantId, {quotes: [quote]})
      const shortCode = await this.getOrgShortCode(xero, tenantId)
      return {resource: response.body.quotes?.[0], shortCode}
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Quote created: ${r?.quoteNumber} (${r?.quoteID})`)
      if (shortCode && r?.quoteID) {
        this.log(`View in Xero: ${quoteDeepLink(shortCode, r.quoteID as string)}`)
      }
    }
  }
}
