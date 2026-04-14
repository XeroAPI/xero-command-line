import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {uploadAttachment} from '../../../lib/attachments.js'

export default class QuotesAttachmentsUpload extends BaseCommand {
  static override description = 'Upload an attachment to a quote'

  static override examples = [
    '<%= config.bin %> quotes attachments upload --quote-id abc-123 --file proposal.pdf',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'quote-id': Flags.string({description: 'Quote ID', required: true}),
    file: Flags.string({description: 'Path to file to upload', required: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(QuotesAttachmentsUpload)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      uploadAttachment(xero, tenantId, 'quote', flags['quote-id'], flags.file, false),
    )

    const r = result as Record<string, unknown>
    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      this.log(`Attachment uploaded: ${r.fileName} (${r.attachmentID})`)
    }
  }
}
