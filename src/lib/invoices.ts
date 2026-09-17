import {randomUUID} from 'node:crypto'
import {chmod, mkdir, rename, rm, writeFile} from 'node:fs/promises'
import {dirname, join, resolve} from 'node:path'

export interface OnlineInvoiceResult {
  invoiceID: string
  onlineInvoiceUrl?: string
  available: boolean
}

export interface InvoicePdfData {
  contentType: string
  pdf: Buffer
}

export interface InvoicePdfResult {
  invoiceID: string
  contentType: string
  bytes: number
  savedTo: string
}

export function extractOnlineInvoiceResult(
  invoiceID: string,
  onlineInvoices: Array<{onlineInvoiceUrl?: string}> | undefined,
): OnlineInvoiceResult {
  const onlineInvoiceUrl = onlineInvoices
    ?.map(invoice => invoice.onlineInvoiceUrl?.trim())
    .find((url): url is string => Boolean(url))

  return {
    invoiceID,
    ...(onlineInvoiceUrl ? {onlineInvoiceUrl} : {}),
    available: Boolean(onlineInvoiceUrl),
  }
}

export function normalizeInvoicePdf(body: Buffer | Uint8Array, contentType: string | undefined): InvoicePdfData {
  const normalizedContentType = contentType?.trim() ?? ''
  const mediaType = normalizedContentType.split(';', 1)[0].trim().toLowerCase()
  if (mediaType !== 'application/pdf') {
    throw new Error(`Unexpected invoice PDF content type: ${normalizedContentType || 'missing'}`)
  }

  const pdf = Buffer.isBuffer(body) ? body : Buffer.from(body)
  if (pdf.length === 0) {
    throw new Error('Xero returned an empty invoice PDF')
  }

  return {contentType: normalizedContentType, pdf}
}

export async function saveInvoicePdf(pdf: Buffer, outputPath: string): Promise<string> {
  const destination = resolve(outputPath)
  const directory = dirname(destination)
  const temporaryPath = join(directory, `.xero-invoice-${process.pid}-${randomUUID()}.tmp`)

  try {
    await mkdir(directory, {recursive: true, mode: 0o700})
    await writeFile(temporaryPath, pdf, {flag: 'wx', mode: 0o600})
    await chmod(temporaryPath, 0o600)
    await rename(temporaryPath, destination)
    return destination
  } catch (error) {
    await rm(temporaryPath, {force: true}).catch(() => undefined)
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to save invoice PDF to ${destination}: ${message}`)
  }
}
