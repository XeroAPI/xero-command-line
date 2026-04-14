import * as fs from 'node:fs'
import * as path from 'node:path'
import {XeroClient} from 'xero-node'
import type {Attachment} from 'xero-node'

export type AttachmentResource =
  | 'invoice'
  | 'creditNote'
  | 'bankTransaction'
  | 'quote'
  | 'contact'
  | 'account'
  | 'manualJournal'

const MIME_MAP: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.xml':  'application/xml',
  '.csv':  'text/csv',
  '.txt':  'text/plain',
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const mime = MIME_MAP[ext]
  if (!mime) throw new Error(`Unsupported file type: ${ext}`)
  return mime
}

export function validateUploadFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`)
  }
  const stat = fs.statSync(filePath)
  const maxBytes = 25 * 1024 * 1024
  if (stat.size > maxBytes) {
    const mb = (stat.size / 1024 / 1024).toFixed(1)
    throw new Error(`File exceeds 25MB limit (actual: ${mb} MB)`)
  }
}

// Resources that support includeOnline on upload
const SUPPORTS_INCLUDE_ONLINE = new Set<AttachmentResource>(['invoice', 'creditNote'])

const UPLOAD_METHOD: Record<AttachmentResource, string> = {
  invoice:         'createInvoiceAttachmentByFileName',
  creditNote:      'createCreditNoteAttachmentByFileName',
  bankTransaction: 'createBankTransactionAttachmentByFileName',
  quote:           'createQuoteAttachmentByFileName',
  contact:         'createContactAttachmentByFileName',
  account:         'createAccountAttachmentByFileName',
  manualJournal:   'createManualJournalAttachmentByFileName',
}

const LIST_METHOD: Record<AttachmentResource, string> = {
  invoice:         'getInvoiceAttachments',
  creditNote:      'getCreditNoteAttachments',
  bankTransaction: 'getBankTransactionAttachments',
  quote:           'getQuoteAttachments',
  contact:         'getContactAttachments',
  account:         'getAccountAttachments',
  manualJournal:   'getManualJournalAttachments',
}

const DOWNLOAD_METHOD: Record<AttachmentResource, string> = {
  invoice:         'getInvoiceAttachmentById',
  creditNote:      'getCreditNoteAttachmentById',
  bankTransaction: 'getBankTransactionAttachmentById',
  quote:           'getQuoteAttachmentById',
  contact:         'getContactAttachmentById',
  account:         'getAccountAttachmentById',
  manualJournal:   'getManualJournalAttachmentById',
}

export async function uploadAttachment(
  xero: XeroClient,
  tenantId: string,
  resource: AttachmentResource,
  resourceId: string,
  filePath: string,
  includeOnline: boolean,
): Promise<Attachment> {
  validateUploadFile(filePath)
  getMimeType(filePath) // throws for unsupported extension

  const fileName = path.basename(filePath)
  const stream = fs.createReadStream(filePath)
  const api = xero.accountingApi as unknown as Record<string, (...args: unknown[]) => Promise<any>>

  let response: any
  if (SUPPORTS_INCLUDE_ONLINE.has(resource)) {
    response = await api[UPLOAD_METHOD[resource]](tenantId, resourceId, fileName, stream, includeOnline, undefined)
  } else {
    response = await api[UPLOAD_METHOD[resource]](tenantId, resourceId, fileName, stream, undefined)
  }

  return response.body.attachments?.[0] as Attachment
}

export async function listAttachments(
  xero: XeroClient,
  tenantId: string,
  resource: AttachmentResource,
  resourceId: string,
): Promise<Attachment[]> {
  const api = xero.accountingApi as unknown as Record<string, (...args: unknown[]) => Promise<any>>
  const response = await api[LIST_METHOD[resource]](tenantId, resourceId)
  return (response.body.attachments ?? []) as Attachment[]
}

export async function downloadAttachment(
  xero: XeroClient,
  tenantId: string,
  resource: AttachmentResource,
  resourceId: string,
  attachmentId: string,
): Promise<{fileName: string; data: Buffer}> {
  // Resolve filename + mimeType from list
  const attachments = await listAttachments(xero, tenantId, resource, resourceId)
  const meta = attachments.find(a => a.attachmentID === attachmentId)
  if (!meta) throw new Error(`Attachment not found: ${attachmentId}`)

  const fileName = meta.fileName ?? 'attachment'
  const mimeType = meta.mimeType ?? 'application/octet-stream'

  const api = xero.accountingApi as unknown as Record<string, (...args: unknown[]) => Promise<any>>
  const response = await api[DOWNLOAD_METHOD[resource]](tenantId, resourceId, attachmentId, mimeType)
  return {fileName, data: response.body as Buffer}
}
