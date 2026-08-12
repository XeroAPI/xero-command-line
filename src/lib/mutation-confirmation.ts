import {createHash, timingSafeEqual} from 'node:crypto'

const REDACTED = '[REDACTED]'
const MAX_ORGANISATION_LENGTH = 128

type JsonValue = boolean | null | number | string | JsonValue[] | {[key: string]: JsonValue}

export interface MutationPreview {
  dryRun: true
  operation: string
  organisation: {tenantId: string}
  proposed: Record<string, unknown>
  confirmation: string
  instruction: string
}

type MutationResult<T> =
  | {executed: false; preview: MutationPreview}
  | {executed: true; value: T}

interface ConfirmedMutationOptions<T> {
  operation: string
  tenantId: string
  payload: unknown
  proposed: Record<string, unknown>
  dryRun: boolean
  confirmation?: string
  mutate: () => Promise<T>
}

function canonicalise(value: unknown): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Cannot confirm a payload containing a non-finite number.')
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item) => item === undefined ? null : canonicalise(item))
  }
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, item]) => [key, canonicalise(item)]),
    )
  }
  throw new Error('Cannot confirm a payload containing an unsupported value.')
}

function confirmationFor(operation: string, tenantId: string, payload: unknown): string {
  const canonicalPayload = JSON.stringify(canonicalise(payload))
  return createHash('sha256')
    .update(JSON.stringify([operation, tenantId, canonicalPayload]))
    .digest('hex')
}

function confirmationMatches(actual: string | undefined, expected: string): boolean {
  if (!actual || !/^[a-f0-9]{64}$/.test(actual)) return false
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}

function safeOrganisationId(tenantId: string): string {
  return tenantId.split(/[\u0000-\u001F\u007F-\u009F]/, 1)[0].slice(0, MAX_ORGANISATION_LENGTH)
}

function redactedIfPresent(value: unknown): string | undefined {
  return value === undefined || value === null || value === '' ? undefined : REDACTED
}

function boundedText(value: unknown, maxLength = 32): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.split(/[\u0000-\u001F\u007F-\u009F]/, 1)[0].slice(0, maxLength)
}

export function paymentMutationSummary(payment: Record<string, unknown>): Record<string, unknown> {
  return {
    invoice: redactedIfPresent(payment.invoice ?? payment.invoiceID ?? payment.invoiceId),
    account: redactedIfPresent(payment.account ?? payment.accountID ?? payment.accountId),
    amount: typeof payment.amount === 'number' && Number.isFinite(payment.amount) ? payment.amount : undefined,
    date: boundedText(payment.date),
    reference: redactedIfPresent(payment.reference),
  }
}

export function manualJournalMutationSummary(journal: Record<string, unknown>): Record<string, unknown> {
  const lines = journal.journalLines
  return {
    narration: redactedIfPresent(journal.narration),
    date: boundedText(journal.date),
    status: boundedText(journal.status),
    lineAmountTypes: boundedText(journal.lineAmountTypes),
    journalLines: {
      count: Array.isArray(lines) ? lines.length : 0,
      content: REDACTED,
    },
  }
}

export async function runConfirmedMutation<T>(options: ConfirmedMutationOptions<T>): Promise<MutationResult<T>> {
  const expectedConfirmation = confirmationFor(options.operation, options.tenantId, options.payload)
  if (options.dryRun) {
    return {
      executed: false,
      preview: {
        dryRun: true,
        operation: options.operation,
        organisation: {tenantId: safeOrganisationId(options.tenantId)},
        proposed: options.proposed,
        confirmation: expectedConfirmation,
        instruction: 'Rerun the same command with --confirm <confirmation> to execute.',
      },
    }
  }

  if (!confirmationMatches(options.confirmation, expectedConfirmation)) {
    throw new Error('Confirmation required. Run with --dry-run, then rerun the same command with the returned --confirm value.')
  }

  return {executed: true, value: await options.mutate()}
}

export function formatMutationPreview(preview: MutationPreview, json: boolean): string {
  if (json) return JSON.stringify(preview, null, 2)
  return [
    'Dry run only; no Xero mutation was performed.',
    `Operation: ${preview.operation}`,
    `Organisation tenant ID: ${preview.organisation.tenantId}`,
    `Proposed: ${JSON.stringify(preview.proposed)}`,
    `Confirmation: ${preview.confirmation}`,
    preview.instruction,
  ].join('\n')
}
