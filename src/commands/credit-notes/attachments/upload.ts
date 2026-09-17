import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {uploadAttachment} from '../../../lib/attachments.js'

export default class CreditNotesAttachmentsUpload extends BaseCommand {
  static override description = 'Upload an attachment to a credit note'

  static override examples = [
    '<%= config.bin %> credit-notes attachments upload --credit-note-id abc-123 --file receipt.pdf',
    '<%= config.bin %> credit-notes attachments upload --credit-note-id abc-123 --file receipt.pdf --include-online',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'credit-note-id': Flags.string({description: 'Credit Note ID', required: true}),
    file: Flags.string({description: 'Path to file to upload', required: true}),
    'include-online': Flags.boolean({description: 'Show attachment in online credit note view', default: false}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(CreditNotesAttachmentsUpload)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      uploadAttachment(xero, tenantId, 'creditNote', flags['credit-note-id'], flags.file, flags['include-online']),
    )

    const r = result as Record<string, unknown>
    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      this.log(`Attachment uploaded: ${r.fileName} (${r.attachmentID})`)
    }
  }
}
