import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {listAttachments} from '../../../lib/attachments.js'

export default class InvoicesAttachmentsList extends BaseCommand {
  static override description = 'List attachments on an invoice'

  static override examples = [
    '<%= config.bin %> invoices attachments list --invoice-id abc-123',
    '<%= config.bin %> invoices attachments list --invoice-id abc-123 --json',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'invoice-id': Flags.string({description: 'Invoice ID', required: true}),
  }

  private readonly columns = [
    {key: 'attachmentID', header: 'ID'},
    {key: 'fileName', header: 'File Name'},
    {key: 'mimeType', header: 'Type'},
    {key: 'contentLength', header: 'Size (bytes)'},
    {key: 'url', header: 'URL'},
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(InvoicesAttachmentsList)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      listAttachments(xero, tenantId, 'invoice', flags['invoice-id']),
    )

    this.outputFormatted(result as unknown as Record<string, unknown>[], this.columns, flags)
  }
}
