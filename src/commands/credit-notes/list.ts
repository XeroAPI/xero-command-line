import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {formatOutput, formatStatus, formatCurrency, formatDate} from '../../lib/formatters.js'

export default class CreditNotesList extends BaseCommand {
  static override description = 'List credit notes in Xero'

  static override examples = [
    '<%= config.bin %> credit-notes list',
    '<%= config.bin %> credit-notes list --contact-id abc-123',
    '<%= config.bin %> credit-notes list --credit-note-number CN-0001',
    '<%= config.bin %> credit-notes list --credit-note-number CN-0001 --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'contact-id': Flags.string({description: 'Filter by contact ID'}),
    'credit-note-number': Flags.string({description: 'Filter by credit note number'}),
    page: Flags.integer({description: 'Page number', default: 1}),
  }

  private readonly creditNoteColumns = [
    {key: 'creditNoteID', header: 'ID'},
    {key: 'creditNoteNumber', header: 'Number'},
    {key: 'contact.name', header: 'Contact'},
    {key: 'date', header: 'Date', format: (v: unknown) => formatDate(v)},
    {key: 'total', header: 'Total', format: (v: unknown) => formatCurrency(v)},
    {key: 'remainingCredit', header: 'Remaining', format: (v: unknown) => formatCurrency(v)},
    {key: 'status', header: 'Status', format: (v: unknown) => formatStatus(String(v ?? ''))},
  ]

  private readonly lineItemColumns = [
    {key: 'description', header: 'Description'},
    {key: 'quantity', header: 'Qty', format: (v: unknown) => String(v ?? '')},
    {key: 'unitAmount', header: 'Unit Price', format: (v: unknown) => formatCurrency(v)},
    {key: 'taxType', header: 'Tax Type'},
    {key: 'accountCode', header: 'Account'},
    {key: 'lineAmount', header: 'Amount', format: (v: unknown) => formatCurrency(v)},
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(CreditNotesList)

    const hasCreditNoteNumber = Boolean(flags['credit-note-number'])

    const result = await this.xeroCall(flags, async (xero, tenantId) => {
      const whereClauses: string[] = []
      if (flags['contact-id']) {
        whereClauses.push(`Contact.ContactID=guid("${flags['contact-id']}")`)
      }

      if (flags['credit-note-number']) {
        whereClauses.push(`CreditNoteNumber="${flags['credit-note-number']}"`)
      }

      const where = whereClauses.length > 0 ? whereClauses.join(' AND ') : undefined
      const response = await xero.accountingApi.getCreditNotes(
        tenantId,
        undefined,
        where,
        undefined,
        flags.page,
      )
      return response.body.creditNotes ?? []
    })

    const creditNotes = result as unknown as Record<string, unknown>[]

    if (hasCreditNoteNumber && !flags.json) {
      if (flags.csv) {
        const mergedColumns = [
          ...this.creditNoteColumns,
          ...this.lineItemColumns,
        ]
        const flatRows: Record<string, unknown>[] = []
        for (const cn of creditNotes) {
          const lineItems = (cn.lineItems ?? []) as Record<string, unknown>[]
          if (lineItems.length > 0) {
            for (const item of lineItems) {
              flatRows.push({...cn, ...item})
            }
          } else {
            flatRows.push({...cn})
          }
        }

        this.log(formatOutput(flatRows, mergedColumns, 'csv'))
      } else {
        for (const cn of creditNotes) {
          const num = cn.creditNoteNumber ?? ''
          const contact = (cn.contact as Record<string, unknown>)?.name ?? ''
          const date = formatDate(cn.date)
          const status = formatStatus(String(cn.status ?? ''))
          const total = formatCurrency(cn.total)
          const remaining = formatCurrency(cn.remainingCredit)

          this.log(`Credit Note: ${num} | ${contact} | ${date} | ${status}`)
          this.log(`Total: ${total} | Remaining: ${remaining}`)

          const lineItems = (cn.lineItems ?? []) as Record<string, unknown>[]
          if (lineItems.length > 0) {
            this.outputFormatted(lineItems, this.lineItemColumns, flags)
          }

          this.log('')
        }
      }
    } else {
      this.outputFormatted(creditNotes, this.creditNoteColumns, flags)
    }
  }
}
