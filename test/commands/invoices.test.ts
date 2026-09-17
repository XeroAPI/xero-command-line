import {mkdtemp, readFile, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import type {Config} from '@oclif/core'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {BaseCommand} from '../../src/base-command.js'
import InvoicesOnlineUrl from '../../src/commands/invoices/online-url.js'
import InvoicesPdf from '../../src/commands/invoices/pdf.js'

const temporaryDirectories: string[] = []
const commandConfig = {
  bin: 'xero',
  runHook: async () => ({successes: [], failures: []}),
} as unknown as Config

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, {recursive: true, force: true})))
})

function mockXeroCall(accountingApi: Record<string, unknown>): void {
  const prototype = BaseCommand.prototype as unknown as {
    xeroCall: (
      flags: Record<string, unknown>,
      operation: (xero: {accountingApi: Record<string, unknown>}, tenantId: string) => Promise<unknown>,
    ) => Promise<unknown>
  }

  vi.spyOn(prototype, 'xeroCall').mockImplementation(async (_flags, operation) => {
    return operation({accountingApi}, 'tenant-1')
  })
}

describe('invoices online-url', () => {
  it('calls the dedicated endpoint and prints the customer-facing URL', async () => {
    const getOnlineInvoice = vi.fn().mockResolvedValue({
      body: {onlineInvoices: [{onlineInvoiceUrl: 'https://in.xero.com/example'}]},
    })
    mockXeroCall({getOnlineInvoice})
    const log = vi.spyOn(InvoicesOnlineUrl.prototype, 'log').mockImplementation(() => {})

    await new InvoicesOnlineUrl(['--invoice-id', 'invoice-1'], commandConfig).run()

    expect(getOnlineInvoice).toHaveBeenCalledWith('tenant-1', 'invoice-1')
    expect(log).toHaveBeenCalledWith('https://in.xero.com/example')
  })

  it('returns stable structured output when no URL is available', async () => {
    mockXeroCall({
      getOnlineInvoice: vi.fn().mockResolvedValue({body: {onlineInvoices: [{}]}}),
    })
    const log = vi.spyOn(InvoicesOnlineUrl.prototype, 'log').mockImplementation(() => {})

    await new InvoicesOnlineUrl([
      '--invoice-id', 'invoice-1', '--json',
    ], commandConfig).run()

    expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({invoiceID: 'invoice-1', available: false})
  })
})

describe('invoices pdf', () => {
  it('downloads the PDF through the SDK and saves it to the requested path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'xero-command-line-command-pdf-'))
    temporaryDirectories.push(directory)
    const output = join(directory, 'invoice.pdf')
    const pdf = Buffer.from('%PDF-1.7\nexample')
    const getInvoiceAsPdf = vi.fn().mockResolvedValue({
      response: {headers: {'content-type': 'application/pdf'}},
      body: pdf,
    })
    mockXeroCall({getInvoiceAsPdf})
    const log = vi.spyOn(InvoicesPdf.prototype, 'log').mockImplementation(() => {})

    await new InvoicesPdf([
      '--invoice-id', 'invoice-1', '--output', output, '--json',
    ], commandConfig).run()

    expect(getInvoiceAsPdf).toHaveBeenCalledWith('tenant-1', 'invoice-1')
    expect(await readFile(output)).toEqual(pdf)
    expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual({
      invoiceID: 'invoice-1',
      contentType: 'application/pdf',
      bytes: pdf.length,
      savedTo: output,
    })
  })
})
