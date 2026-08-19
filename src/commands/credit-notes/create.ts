import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {creditNoteCreateSchema, creditNoteFileCreateSchema, formatZodError} from '../../lib/validators.js'
import {creditNoteDeepLink} from '../../lib/deeplinks.js'
import {ensureContactNested} from '../../lib/file-data.js'
import {formatMutationPreview, mutationSummary, runConfirmedMutation} from '../../lib/mutation-confirmation.js'
import {CreditNote} from 'xero-node'
import type {LineItem} from 'xero-node'

export default class CreditNotesCreate extends BaseCommand {
  static override description = 'Create a credit note in Xero'

  static override examples = [
    '<%= config.bin %> credit-notes create --file credit-note.json --dry-run',
    '<%= config.bin %> credit-notes create --file credit-note.json --confirm <confirmation>',
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
    'dry-run': Flags.boolean({description: 'Preview without creating a credit note', default: false}),
    confirm: Flags.string({description: 'Organisation- and payload-bound value returned by --dry-run'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(CreditNotesCreate)

    let noteData: CreditNote
    if (flags.file) {
      const fileData = this.readJsonFile(flags.file) as Record<string, unknown>
      const parsed = creditNoteFileCreateSchema.safeParse(fileData)
      if (!parsed.success) {
        this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
      }

      noteData = ensureContactNested(fileData) as CreditNote
    } else {
      const data = {
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

      const parsed = creditNoteCreateSchema.safeParse(data)
      if (!parsed.success) {
        this.error(`Validation errors:\n${formatZodError(parsed.error)}`)
      }

      const lineItems: LineItem[] = parsed.data.lineItems.map(li => ({
        description: li.description,
        quantity: li.quantity,
        unitAmount: li.unitAmount,
        accountCode: li.accountCode,
        taxType: li.taxType,
      }))

      noteData = {
        type: CreditNote.TypeEnum.ACCPAYCREDIT,
        contact: {contactID: parsed.data.contactId},
        lineItems,
        reference: parsed.data.reference,
      }
    }

    const outcome = await this.xeroCall(flags, async (xero, tenantId, tenantName) => runConfirmedMutation({
      operation: 'credit-notes.create',
      tenantId,
      tenantName,
      payload: noteData,
      proposed: mutationSummary(noteData as unknown as Record<string, unknown>),
      dryRun: flags['dry-run'],
      confirmation: flags.confirm,
      mutate: async () => {
        const response = await xero.accountingApi.createCreditNotes(tenantId, {creditNotes: [noteData]})
        const shortCode = await this.getOrgShortCode(xero, tenantId)
        return {resource: response.body.creditNotes?.[0], shortCode}
      },
    }))

    if (!outcome.executed) {
      this.log(formatMutationPreview(outcome.preview, flags.json))
      return
    }

    const {resource: result, shortCode} = outcome.value
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
