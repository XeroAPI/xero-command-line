import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {uploadAttachment} from '../../../lib/attachments.js'

export default class ContactsAttachmentsUpload extends BaseCommand {
  static override description = 'Upload an attachment to a contact'

  static override examples = [
    '<%= config.bin %> contacts attachments upload --contact-id abc-123 --file contract.pdf',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'contact-id': Flags.string({description: 'Contact ID', required: true}),
    file: Flags.string({description: 'Path to file to upload', required: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ContactsAttachmentsUpload)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      uploadAttachment(xero, tenantId, 'contact', flags['contact-id'], flags.file, false),
    )

    const r = result as Record<string, unknown>
    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      this.log(`Attachment uploaded: ${r.fileName} (${r.attachmentID})`)
    }
  }
}
