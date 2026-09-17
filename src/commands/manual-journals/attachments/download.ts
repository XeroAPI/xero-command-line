import {Flags} from '@oclif/core'
import {BaseCommand} from '../../../base-command.js'
import {downloadAttachment} from '../../../lib/attachments.js'
import * as fs from 'node:fs'
import * as path from 'node:path'

export default class ManualJournalsAttachmentsDownload extends BaseCommand {
  static override description = 'Download an attachment from a manual journal'

  static override examples = [
    '<%= config.bin %> manual-journals attachments download --manual-journal-id abc-123 --attachment-id def-456',
  ]

  static override flags = {
    ...BaseCommand.baseFlags,
    'manual-journal-id': Flags.string({description: 'Manual Journal ID', required: true}),
    'attachment-id': Flags.string({description: 'Attachment ID', required: true}),
    output: Flags.string({description: 'Output path (file or directory). Defaults to current directory.'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(ManualJournalsAttachmentsDownload)

    const result = await this.xeroCall(flags, async (xero, tenantId) =>
      downloadAttachment(xero, tenantId, 'manualJournal', flags['manual-journal-id'], flags['attachment-id']),
    )

    const {fileName, data} = result as {fileName: string; data: Buffer}
    const outputPath = resolveOutputPath(flags.output, fileName)
    fs.writeFileSync(outputPath, data)
    this.log(`Saved: ${outputPath}`)
  }
}

function resolveOutputPath(output: string | undefined, fileName: string): string {
  if (!output) return path.join(process.cwd(), fileName)
  if (fs.existsSync(output) && fs.statSync(output).isDirectory()) {
    return path.join(output, fileName)
  }
  return output
}
