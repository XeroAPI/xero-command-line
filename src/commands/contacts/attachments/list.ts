import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {listAttachments} from '../../../lib/attachments.js'

export default class ContactsAttachmentsList extends BaseCommand {
  static override description = 'List attachments on a contact'

  static override examples = [
    '<%= config.bin %> contacts attachments list --contact-id abc-123',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'contact-id': Flags.string({description: 'Contact ID', required: true}),
  }

  private readonly columns = [
    {key: 'attachmentID', header: 'ID'},
    {key: 'fileName', header: 'File Name'},
    {key: 'mimeType', header: 'Type'},
    {key: 'contentLength', header: 'Size (bytes)'},
    {key: 'url', header: 'URL'},
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(ContactsAttachmentsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      listAttachments(xero, tenantId, 'contact', flags['contact-id']),
    )

    this.outputFormatted(result as unknown as Record<string, unknown>[], this.columns, flags)
  }
}
