import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {uploadAttachment} from '../../../lib/attachments.js'

export default class InvoicesAttachmentsUpload extends BaseCommand {
  static override description = 'Upload an attachment to an invoice'

  static override examples = [
    '<%= config.bin %> invoices attachments upload --invoice-id abc-123 --file receipt.pdf',
    '<%= config.bin %> invoices attachments upload --invoice-id abc-123 --file receipt.pdf --include-online',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'invoice-id': Flags.string({description: 'Invoice ID', required: true}),
    file: Flags.string({description: 'Path to file to upload', required: true}),
    'include-online': Flags.boolean({description: 'Show attachment in online invoice view', default: false}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(InvoicesAttachmentsUpload)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      uploadAttachment(xero, tenantId, 'invoice', flags['invoice-id'], flags.file, flags['include-online']),
    )

    const r = result as Record<string, unknown>
    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      this.log(`Attachment uploaded: ${r.fileName} (${r.attachmentID})`)
    }
  }
}
