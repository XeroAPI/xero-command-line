import {captureOutput} from '@oclif/test'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {BaseCommand} from '../../src/base-command.js'
import BankTransactionsCreate from '../../src/commands/bank-transactions/create.js'
import CreditNotesCreate from '../../src/commands/credit-notes/create.js'
import InvoicesCreate from '../../src/commands/invoices/create.js'
import ManualJournalsCreate from '../../src/commands/manual-journals/create.js'
import PaymentsCreate from '../../src/commands/payments/create.js'

const tenantId = '00000000-0000-0000-0000-000000000123'

function confirmationFrom(output: string): string {
  const match = /Confirmation: ([a-f0-9]{64})/.exec(output)
  if (!match) throw new Error('Dry-run confirmation missing')
  return match[1]
}

function mockXeroCall(xero: Record<string, unknown>): void {
  vi.spyOn(BaseCommand.prototype as any, 'xeroCall').mockImplementation(
    async (_flags: unknown, operation: (client: unknown, selectedTenantId: string) => Promise<unknown>) => (
      operation(xero, tenantId)
    ),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('payments create confirmation', () => {
  it('calls no create SDK method for missing, wrong, or dry-run confirmation and once for a valid value', async () => {
    const createPayment = vi.fn(async () => ({body: {payments: [{paymentID: 'payment-1'}]}}))
    mockXeroCall({accountingApi: {createPayment}})
    vi.spyOn(BaseCommand.prototype as any, 'getOrgShortCode').mockResolvedValue(undefined)
    const output: string[] = []
    vi.spyOn(BaseCommand.prototype as any, 'log').mockImplementation((message: string) => output.push(message))
    const command = ['--invoice-id', 'invoice-1', '--account-id', 'account-1', '--amount', '250.50']

    const missing = await captureOutput(() => PaymentsCreate.run(command))
    expect(missing.error?.message).toContain('Confirmation required')
    expect(createPayment).not.toHaveBeenCalled()

    const wrong = await captureOutput(() => PaymentsCreate.run([...command, '--confirm', '0'.repeat(64)]))
    expect(wrong.error?.message).toContain('Confirmation required')
    expect(createPayment).not.toHaveBeenCalled()

    const dryRun = await captureOutput(() => PaymentsCreate.run([
      ...command,
      '--dry-run',
      '--confirm',
      '0'.repeat(64),
    ]))
    expect(dryRun.error).toBeUndefined()
    const dryRunOutput = output.at(-1) ?? ''
    expect(dryRunOutput).toContain(`Organisation tenant ID: ${tenantId}`)
    expect(createPayment).not.toHaveBeenCalled()

    const confirmation = confirmationFrom(dryRunOutput)
    const confirmedDryRun = await captureOutput(() => PaymentsCreate.run([
      ...command,
      '--dry-run',
      '--confirm',
      confirmation,
    ]))
    expect(confirmedDryRun.error).toBeUndefined()
    expect(createPayment).not.toHaveBeenCalled()

    const confirmed = await captureOutput(() => PaymentsCreate.run([
      ...command,
      '--confirm',
      confirmation,
    ]))
    expect(confirmed.error).toBeUndefined()
    expect(createPayment).toHaveBeenCalledTimes(1)
    expect(createPayment).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({amount: 250.5}),
    )
  })
})

describe('manual-journals create confirmation', () => {
  it('calls no create SDK method for missing, wrong, or dry-run confirmation and once for a valid value', async () => {
    const journal = {
      narration: 'Synthetic adjustment',
      journalLines: [
        {lineAmount: 100, accountCode: '200', description: 'secret-debit-marker'},
        {lineAmount: -100, accountCode: '400', description: 'secret-credit-marker'},
      ],
    }
    const createManualJournals = vi.fn(async () => ({
      body: {manualJournals: [{manualJournalID: 'journal-1'}]},
    }))
    mockXeroCall({accountingApi: {createManualJournals}})
    vi.spyOn(BaseCommand.prototype as any, 'readJsonFile').mockReturnValue(journal)
    const output: string[] = []
    vi.spyOn(BaseCommand.prototype as any, 'log').mockImplementation((message: string) => output.push(message))
    const command = ['--file', 'synthetic-journal.json']

    const missing = await captureOutput(() => ManualJournalsCreate.run(command))
    expect(missing.error?.message).toContain('Confirmation required')
    expect(createManualJournals).not.toHaveBeenCalled()

    const wrong = await captureOutput(() => ManualJournalsCreate.run([
      ...command,
      '--confirm',
      '0'.repeat(64),
    ]))
    expect(wrong.error?.message).toContain('Confirmation required')
    expect(createManualJournals).not.toHaveBeenCalled()

    const dryRun = await captureOutput(() => ManualJournalsCreate.run([
      ...command,
      '--dry-run',
      '--confirm',
      '0'.repeat(64),
    ]))
    expect(dryRun.error).toBeUndefined()
    const dryRunOutput = output.at(-1) ?? ''
    expect(dryRunOutput).toContain(`Organisation tenant ID: ${tenantId}`)
    expect(dryRunOutput).not.toContain('secret-debit-marker')
    expect(dryRunOutput).not.toContain('secret-credit-marker')
    expect(createManualJournals).not.toHaveBeenCalled()

    const confirmation = confirmationFrom(dryRunOutput)
    const confirmedDryRun = await captureOutput(() => ManualJournalsCreate.run([
      ...command,
      '--dry-run',
      '--confirm',
      confirmation,
    ]))
    expect(confirmedDryRun.error).toBeUndefined()
    expect(createManualJournals).not.toHaveBeenCalled()

    const confirmed = await captureOutput(() => ManualJournalsCreate.run([
      ...command,
      '--confirm',
      confirmation,
    ]))
    expect(confirmed.error).toBeUndefined()
    expect(createManualJournals).toHaveBeenCalledTimes(1)
    expect(createManualJournals).toHaveBeenCalledWith(
      tenantId,
      {manualJournals: [expect.objectContaining({narration: 'Synthetic adjustment', status: 'DRAFT'})]},
    )
  })
})

describe('payments create confirmation from a file payload', () => {
  it('binds the confirmation to the payload the SDK actually receives', async () => {
    const createPayment = vi.fn(async () => ({body: {payments: [{paymentID: 'payment-1'}]}}))
    mockXeroCall({accountingApi: {createPayment}})
    vi.spyOn(BaseCommand.prototype as any, 'getOrgShortCode').mockResolvedValue(undefined)
    // Top-level IDs, so ensureInvoiceNested/ensureAccountNested rewrite the
    // object between validation and hashing.
    vi.spyOn(BaseCommand.prototype as any, 'readJsonFile').mockReturnValue({
      invoiceID: 'invoice-1',
      accountID: 'account-1',
      amount: 250.5,
      currencyRate: 1.25,
    })
    const output: string[] = []
    vi.spyOn(BaseCommand.prototype as any, 'log').mockImplementation((message: string) => output.push(message))
    const command = ['--file', 'synthetic-payment.json']

    const missing = await captureOutput(() => PaymentsCreate.run(command))
    expect(missing.error?.message).toContain('Confirmation required')
    expect(createPayment).not.toHaveBeenCalled()

    const dryRun = await captureOutput(() => PaymentsCreate.run([...command, '--dry-run']))
    expect(dryRun.error).toBeUndefined()
    const dryRunOutput = output.at(-1) ?? ''
    expect(dryRunOutput).toContain('invoice-1')
    expect(dryRunOutput).toContain('account-1')
    expect(dryRunOutput).toContain('1.25')
    expect(createPayment).not.toHaveBeenCalled()

    const confirmed = await captureOutput(() => PaymentsCreate.run([
      ...command,
      '--confirm',
      confirmationFrom(dryRunOutput),
    ]))
    expect(confirmed.error).toBeUndefined()
    expect(createPayment).toHaveBeenCalledTimes(1)
    expect(createPayment).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        invoice: {invoiceID: 'invoice-1'},
        account: {accountID: 'account-1'},
        amount: 250.5,
      }),
    )
  })
})

describe('consequential create gates', () => {
  it.each([
    [
      'invoices',
      InvoicesCreate,
      'createInvoices',
      {body: {invoices: [{invoiceID: 'invoice-1'}]}},
      [
        '--contact-id', 'contact-1', '--type', 'ACCREC', '--description', 'Consulting',
        '--quantity', '2', '--unit-amount', '150', '--account-code', '200', '--tax-type', 'OUTPUT2',
      ],
    ],
    [
      'credit notes',
      CreditNotesCreate,
      'createCreditNotes',
      {body: {creditNotes: [{creditNoteID: 'credit-note-1'}]}},
      [
        '--contact-id', 'contact-1', '--description', 'Refund', '--quantity', '1',
        '--unit-amount', '100', '--account-code', '200', '--tax-type', 'OUTPUT2',
      ],
    ],
    [
      'bank transactions',
      BankTransactionsCreate,
      'createBankTransactions',
      {body: {bankTransactions: [{bankTransactionID: 'bank-transaction-1'}]}},
      [
        '--type', 'SPEND', '--bank-account-id', 'bank-account-1', '--contact-id', 'contact-1',
        '--description', 'Office supplies', '--quantity', '1', '--unit-amount', '50',
        '--account-code', '429', '--tax-type', 'INPUT2',
      ],
    ],
  ] as Array<[string, {run: (argv: string[]) => Promise<unknown>}, string, unknown, string[]]>)(
    '%s create refuses to mutate without a matching confirmation',
    async (_name, Command, method, response, command) => {
      const create = vi.fn(async () => response)
      mockXeroCall({accountingApi: {[method]: create}})
      vi.spyOn(BaseCommand.prototype as any, 'getOrgShortCode').mockResolvedValue(undefined)
      const output: string[] = []
      vi.spyOn(BaseCommand.prototype as any, 'log').mockImplementation((message: string) => output.push(message))

      const missing = await captureOutput(() => Command.run(command))
      expect(missing.error?.message).toContain('Confirmation required')
      expect(create).not.toHaveBeenCalled()

      const wrong = await captureOutput(() => Command.run([...command, '--confirm', '0'.repeat(64)]))
      expect(wrong.error?.message).toContain('Confirmation required')
      expect(create).not.toHaveBeenCalled()

      const dryRun = await captureOutput(() => Command.run([...command, '--dry-run']))
      expect(dryRun.error).toBeUndefined()
      const dryRunOutput = output.at(-1) ?? ''
      expect(dryRunOutput).toContain(`Organisation tenant ID: ${tenantId}`)
      expect(create).not.toHaveBeenCalled()

      const confirmed = await captureOutput(() => Command.run([
        ...command,
        '--confirm',
        confirmationFrom(dryRunOutput),
      ]))
      expect(confirmed.error).toBeUndefined()
      expect(create).toHaveBeenCalledTimes(1)
    },
  )
})
