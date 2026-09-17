import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {uploadAttachment} from '../../../lib/attachments.js'

export default class BankTransactionsAttachmentsUpload extends BaseCommand {
  static override description = 'Upload an attachment to a bank transaction'

  static override examples = [
    '<%= config.bin %> bank-transactions attachments upload --bank-transaction-id abc-123 --file receipt.pdf',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'bank-transaction-id': Flags.string({description: 'Bank Transaction ID', required: true}),
    file: Flags.string({description: 'Path to file to upload', required: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(BankTransactionsAttachmentsUpload)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      uploadAttachment(xero, tenantId, 'bankTransaction', flags['bank-transaction-id'], flags.file, false),
    )

    const r = result as Record<string, unknown>
    if (flags.json) {
      this.log(JSON.stringify(result, null, 2))
    } else {
      this.log(`Attachment uploaded: ${r.fileName} (${r.attachmentID})`)
    }
  }
}
