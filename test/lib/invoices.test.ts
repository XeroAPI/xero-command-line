import {chmod, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, describe, expect, it} from 'vitest'
import {
  extractOnlineInvoiceResult,
  normalizeInvoicePdf,
  saveInvoicePdf,
} from '../../src/lib/invoices.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, {recursive: true, force: true})))
})

describe('extractOnlineInvoiceResult', () => {
  it('returns the first non-empty online invoice URL', () => {
    expect(extractOnlineInvoiceResult('invoice-1', [
      {onlineInvoiceUrl: '  '},
      {onlineInvoiceUrl: ' https://in.xero.com/example '},
    ])).toEqual({
      invoiceID: 'invoice-1',
      onlineInvoiceUrl: 'https://in.xero.com/example',
      available: true,
    })
  })

  it('returns an unavailable result when Xero supplies no URL', () => {
    expect(extractOnlineInvoiceResult('invoice-1', undefined)).toEqual({
      invoiceID: 'invoice-1',
      available: false,
    })
  })
})

describe('normalizeInvoicePdf', () => {
  it('accepts PDF data and preserves the response content type', () => {
    const result = normalizeInvoicePdf(Buffer.from('%PDF-1.7\nexample'), 'application/pdf; charset=binary')

    expect(result.contentType).toBe('application/pdf; charset=binary')
    expect(result.pdf.toString()).toBe('%PDF-1.7\nexample')
  })

  it('rejects a non-PDF response', () => {
    expect(() => normalizeInvoicePdf(Buffer.from('{"Message":"error"}'), 'application/json'))
      .toThrow('Unexpected invoice PDF content type: application/json')
  })

  it('rejects a content type that merely starts with application/pdf', () => {
    expect(() => normalizeInvoicePdf(Buffer.from('%PDF-1.7\nexample'), 'application/pdf-malformed'))
      .toThrow('Unexpected invoice PDF content type: application/pdf-malformed')
  })

  it('rejects an empty PDF response', () => {
    expect(() => normalizeInvoicePdf(Buffer.alloc(0), 'application/pdf'))
      .toThrow('Xero returned an empty invoice PDF')
  })
})

describe('saveInvoicePdf', () => {
  it('creates parent directories and saves the exact PDF bytes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xero-command-line-pdf-'))
    temporaryDirectories.push(directory)
    const output = join(directory, 'nested', 'invoice.pdf')
    const pdf = Buffer.from('%PDF-1.7\nexample')

    const savedTo = await saveInvoicePdf(pdf, output)

    expect(savedTo).toBe(output)
    expect(await readFile(output)).toEqual(pdf)
    if (process.platform !== 'win32') {
      expect((await stat(output)).mode & 0o777).toBe(0o600)
    }
  })

  it('restricts permissions when replacing an existing file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xero-command-line-pdf-existing-'))
    temporaryDirectories.push(directory)
    const output = join(directory, 'invoice.pdf')
    await writeFile(output, 'old PDF')
    if (process.platform !== 'win32') {
      await chmod(output, 0o644)
    }

    await saveInvoicePdf(Buffer.from('%PDF-1.7\nreplacement'), output)

    expect((await readFile(output)).toString()).toBe('%PDF-1.7\nreplacement')
    if (process.platform !== 'win32') {
      expect((await stat(output)).mode & 0o777).toBe(0o600)
    }
  })

  it('preserves an existing destination and cleans up when replacement fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xero-command-line-pdf-failure-'))
    temporaryDirectories.push(directory)
    const output = join(directory, 'invoice.pdf')
    await mkdir(output)
    await writeFile(join(output, 'existing-file'), 'old PDF')

    await expect(saveInvoicePdf(Buffer.from('%PDF-1.7\nreplacement'), output))
      .rejects.toThrow(`Failed to save invoice PDF to ${output}`)

    expect((await readFile(join(output, 'existing-file'))).toString()).toBe('old PDF')
    expect(await readdir(directory)).toEqual(['invoice.pdf'])
  })

  it.runIf(process.platform !== 'win32')('supports destination names near the filesystem limit', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xero-command-line-pdf-long-name-'))
    temporaryDirectories.push(directory)
    const output = join(directory, `${'i'.repeat(220)}.pdf`)
    const pdf = Buffer.from('%PDF-1.7\nexample')

    await saveInvoicePdf(pdf, output)

    expect(await readFile(output)).toEqual(pdf)
  })
})
