import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {creditNoteUpdateSchema, formatZodError} from '../../lib/validators.js'
import type {CreditNote, LineItem} from 'xero-node'

export default class CreditNotesUpdate extends BaseCommand {
  static override description = 'Update a draft credit note in Xero'

  static override examples = [
    '<%= config.bin %> credit-notes update --file credit-note-update.json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    file: Flags.string({description: 'JSON file with credit note update data'}),
    'credit-note-id': Flags.string({description: 'Credit note ID'}),
    'contact-id': Flags.string({description: 'Contact ID'}),
    date: Flags.string({description: 'Credit note date (YYYY-MM-DD)'}),
    reference: Flags.string({description: 'Credit note reference'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(CreditNotesUpdate)

    let data: Record<string, unknown>
    if (flags.file) {
      data = this.readJsonFile(flags.file) as Record<string, unknown>
    } else {
      data = {
        creditNoteId: flags['credit-note-id'],
        contactId: flags['contact-id'],
        date: flags.date,
        reference: flags.reference,
      }
    }

    const parsed = creditNoteUpdateSchema.safeParse(data)
    if (!parsed.success) {
      this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
    }

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const creditNote: CreditNote = {
        creditNoteID: parsed.data.creditNoteId,
        contact: parsed.data.contactId ? {contactID: parsed.data.contactId} : undefined,
        date: parsed.data.date,
        reference: parsed.data.reference,
      }

      if (parsed.data.lineItems) {
        creditNote.lineItems = parsed.data.lineItems.map(li => ({
          description: li.description,
          quantity: li.quantity,
          unitAmount: li.unitAmount,
          accountCode: li.accountCode,
          taxType: li.taxType,
        })) as LineItem[]
      }

      const response = await xero.accountingApi.updateCreditNote(tenantId, parsed.data.creditNoteId, {creditNotes: [creditNote]})
      return response.body.creditNotes?.[0]
    })

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      const r = result as Record<string, unknown> | undefined
      this.log(`Credit note updated: ${r?.creditNoteNumber} (${r?.creditNoteID})`)
    }
  }
}
