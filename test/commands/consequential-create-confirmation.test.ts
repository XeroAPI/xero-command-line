import {captureOutput} from '@oclif/test'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {BaseCommand} from '../../src/base-command.js'
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
