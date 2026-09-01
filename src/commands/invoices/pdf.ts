import {Flags} from '@oclif/core'
import {BaseCommand} from '../../base-command.js'
import {normalizeInvoicePdf, saveInvoicePdf, type InvoicePdfResult} from '../../lib/invoices.js'

export default class InvoicesPdf extends BaseCommand {
  static override description = 'Download an invoice as a PDF'

  static override examples = [
    '<%= config.bin %> invoices pdf --invoice-id 00000000-0000-0000-0000-000000000001 --output invoice.pdf',
    '<%= config.bin %> invoices pdf --invoice-id 00000000-0000-0000-0000-000000000001 --output invoice.pdf --json',
    '<%= config.bin %> invoices pdf --invoice-id 00000000-0000-0000-0000-000000000001 --output - > invoice.pdf',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'invoice-id': Flags.string({description: 'Invoice ID', required: true}),
    output: Flags.string({char: 'o', description: 'Output file path, or - for stdout', required: true}),
  }

  private readonly resultColumns = [
    {key: 'invoiceID', header: 'Invoice ID'},
    {key: 'contentType', header: 'Content Type'},
    {key: 'bytes', header: 'Bytes'},
    {key: 'savedTo', header: 'Saved To'},
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(InvoicesPdf)
    const outputPath = flags.output.trim()

    if (!outputPath) {
      this.error('--output must not be empty')
    }

    if (outputPath === '-') {
      if (flags.json || flags.csv || flags.toon) {
        this.error('--output - cannot be combined with --json, --csv, or --toon')
      }

      if (process.stdout.isTTY) {
        this.error('Refusing to write binary PDF data to an interactive terminal. Use --output <file> or pipe stdout.')
      }
    }

    const {contentType, pdf} = await this.xeroCall(flags, async (xero, tenantId) => {
      const response = await xero.accountingApi.getInvoiceAsPdf(tenantId, flags['invoice-id'])
      const responseContentType = response.response.headers['content-type']
      return normalizeInvoicePdf(response.body, typeof responseContentType === 'string' ? responseContentType : undefined)
    })

    if (outputPath === '-') {
      await new Promise<void>((resolve, reject) => {
        process.stdout.write(pdf, error => error ? reject(error) : resolve())
      })
      return
    }

    const savedTo = await saveInvoicePdf(pdf, outputPath)
    const result: InvoicePdfResult = {
      invoiceID: flags['invoice-id'],
      contentType,
      bytes: pdf.length,
      savedTo,
    }

    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else if (flags.csv || flags.toon) {
      this.outputFormatted([result as unknown as Record<string, unknown>], this.resultColumns, flags)
    } else {
      this.log(`Saved invoice PDF to ${savedTo} (${pdf.length} bytes)`)
    }
  }
}
