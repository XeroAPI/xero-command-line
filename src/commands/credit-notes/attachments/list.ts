import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {listAttachments} from '../../../lib/attachments.js'

export default class CreditNotesAttachmentsList extends BaseCommand {
  static override description = 'List attachments on a credit note'

  static override examples = [
    '<%= config.bin %> credit-notes attachments list --credit-note-id abc-123',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'credit-note-id': Flags.string({description: 'Credit Note ID', required: true}),
  }

  private readonly columns = [
    {key: 'attachmentID', header: 'ID'},
    {key: 'fileName', header: 'File Name'},
    {key: 'mimeType', header: 'Type'},
    {key: 'contentLength', header: 'Size (bytes)'},
    {key: 'url', header: 'URL'},
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(CreditNotesAttachmentsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      listAttachments(xero, tenantId, 'creditNote', flags['credit-note-id']),
    )

    this.outputFormatted(result as unknown as Record<string, unknown>[], this.columns, flags)
  }
}
