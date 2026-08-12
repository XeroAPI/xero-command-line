import {describe, expect, it, vi} from 'vitest'
import {
  formatMutationPreview,
  manualJournalMutationSummary,
  paymentMutationSummary,
  runConfirmedMutation,
} from '../../src/lib/mutation-confirmation.js'

const payment = {
  invoice: {invoiceID: 'invoice-secret-marker'},
  account: {accountID: 'account-secret-marker'},
  amount: 250.5,
  date: '2026-08-13',
  reference: 'reference-secret-marker',
}

describe('runConfirmedMutation', () => {
  it('returns an organisation- and payload-bound dry-run preview without mutating', async () => {
    const mutate = vi.fn(async () => 'created')
    const outcome = await runConfirmedMutation({
      operation: 'payments.create',
      tenantId: 'tenant-123',
      payload: payment,
      proposed: paymentMutationSummary(payment),
      dryRun: true,
      mutate,
    })

    expect(outcome.executed).toBe(false)
    expect(mutate).not.toHaveBeenCalled()
    if (!outcome.executed) {
      expect(outcome.preview.organisation).toEqual({tenantId: 'tenant-123'})
      expect(outcome.preview.confirmation).toMatch(/^[a-f0-9]{64}$/)
      const rendered = formatMutationPreview(outcome.preview, true)
      expect(rendered).not.toContain('invoice-secret-marker')
      expect(rendered).not.toContain('account-secret-marker')
      expect(rendered).not.toContain('reference-secret-marker')
      expect(rendered).toContain('[REDACTED]')
    }
  })

  it('rejects missing, wrong, cross-organisation, and changed-payload confirmation', async () => {
    const mutate = vi.fn(async () => 'created')
    const dryRun = await runConfirmedMutation({
      operation: 'payments.create',
      tenantId: 'tenant-123',
      payload: payment,
      proposed: paymentMutationSummary(payment),
      dryRun: true,
      mutate,
    })
    if (dryRun.executed) throw new Error('Expected dry run')

    for (const options of [
      {tenantId: 'tenant-123', payload: payment, confirmation: undefined},
      {tenantId: 'tenant-123', payload: payment, confirmation: '0'.repeat(64)},
      {tenantId: 'tenant-456', payload: payment, confirmation: dryRun.preview.confirmation},
      {tenantId: 'tenant-123', payload: {...payment, amount: 251}, confirmation: dryRun.preview.confirmation},
    ]) {
      await expect(runConfirmedMutation({
        operation: 'payments.create',
        tenantId: options.tenantId,
        payload: options.payload,
        proposed: paymentMutationSummary(options.payload),
        dryRun: false,
        confirmation: options.confirmation,
        mutate,
      })).rejects.toThrow('Confirmation required')
    }
    expect(mutate).not.toHaveBeenCalled()
  })

  it('executes once only when the exact confirmation matches', async () => {
    const mutate = vi.fn(async () => 'created')
    const dryRun = await runConfirmedMutation({
      operation: 'payments.create',
      tenantId: 'tenant-123',
      payload: payment,
      proposed: paymentMutationSummary(payment),
      dryRun: true,
      mutate,
    })
    if (dryRun.executed) throw new Error('Expected dry run')

    const outcome = await runConfirmedMutation({
      operation: 'payments.create',
      tenantId: 'tenant-123',
      payload: payment,
      proposed: paymentMutationSummary(payment),
      dryRun: false,
      confirmation: dryRun.preview.confirmation,
      mutate,
    })

    expect(outcome).toEqual({executed: true, value: 'created'})
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it('uses stable canonical object ordering for confirmations', async () => {
    const first = await runConfirmedMutation({
      operation: 'payments.create',
      tenantId: 'tenant-123',
      payload: {b: 2, nested: {d: 4, c: 3}, a: 1},
      proposed: {},
      dryRun: true,
      mutate: vi.fn(),
    })
    const second = await runConfirmedMutation({
      operation: 'payments.create',
      tenantId: 'tenant-123',
      payload: {a: 1, nested: {c: 3, d: 4}, b: 2},
      proposed: {},
      dryRun: true,
      mutate: vi.fn(),
    })
    if (first.executed || second.executed) throw new Error('Expected dry runs')

    expect(first.preview.confirmation).toBe(second.preview.confirmation)
  })

  it('keeps manual journal free text and line content out of the bounded preview', async () => {
    const secret = `personal-secret-marker-${'x'.repeat(10_000)}`
    const journal = {
      narration: secret,
      date: `2026-08-13\r\n${secret}`,
      status: 'DRAFT',
      journalLines: [
        {lineAmount: 100, description: secret},
        {lineAmount: -100, description: secret},
      ],
    }
    const outcome = await runConfirmedMutation({
      operation: 'manual-journals.create',
      tenantId: `tenant-123\r\n${secret}`,
      payload: journal,
      proposed: manualJournalMutationSummary(journal),
      dryRun: true,
      mutate: vi.fn(),
    })
    if (outcome.executed) throw new Error('Expected dry run')

    const rendered = formatMutationPreview(outcome.preview, true)
    expect(rendered).not.toContain('personal-secret-marker')
    expect(rendered.length).toBeLessThan(1000)
    expect(outcome.preview.organisation.tenantId).toBe('tenant-123')
    expect(outcome.preview.proposed.date).toBe('2026-08-13')
    expect(outcome.preview.proposed.journalLines).toEqual({count: 2, content: '[REDACTED]'})
  })

  it('fails closed on unsupported payload values before mutation', async () => {
    const mutate = vi.fn()
    await expect(runConfirmedMutation({
      operation: 'payments.create',
      tenantId: 'tenant-123',
      payload: {amount: Number.POSITIVE_INFINITY},
      proposed: {},
      dryRun: false,
      confirmation: '0'.repeat(64),
      mutate,
    })).rejects.toThrow('non-finite number')
    expect(mutate).not.toHaveBeenCalled()
  })
})
