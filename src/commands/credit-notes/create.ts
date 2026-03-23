import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {creditNoteCreateSchema, formatZodError} from '../../lib/validators.js'
import {creditNoteDeepLink} from '../../lib/deeplinks.js'
import {CreditNote} from 'xero-node'
import type {LineItem} from 'xero-node'

export default class CreditNotesCreate extends BaseCommand {
  static override description = 'Create a credit note in Xero'

  static override examples = [
    '<%= config.bin %> credit-notes create --file credit-note.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with credit note data'}),
    'contact-id': Flags.string({description: 'Contact ID'}),
    reference: Flags.string({description: 'Credit note reference'}),
    description: Flags.string({description: 'Line item description'}),
    quantity: Flags.string({description: 'Line item quantity'}),
    'unit-amount': Flags.string({description: 'Line item unit amount'}),
    'account-code': Flags.string({description: 'Line item account code'}),
    'tax-type': Flags.string({description: 'Line item tax type'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(CreditNotesCreate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        contactId: flags['contact-id'],
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

    const parsed = creditNoteCreateSchema.safeParse(data)
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

      const creditNote: CreditNote = {
        type: CreditNote.TypeEnum.ACCPAYCREDIT,
        contact: {contactID: parsed.data.contactId},
        lineItems,
        reference: parsed.data.reference,
      }

      const response = await xero.accountingApi.createCreditNotes(tenantId, {creditNotes: [creditNote]})
      const shortCode = await this.getOrgShortCode(xero, tenantId)
      return {resource: response.body.creditNotes?.[0], shortCode}
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Credit note created: ${r?.creditNoteNumber ?? 'Draft'} (${r?.creditNoteID})`)
      if (shortCode && r?.creditNoteID) {
        this.log(`View in Xero: ${creditNoteDeepLink(shortCode, r.creditNoteID as string)}`)
      }
    }
  }
}
