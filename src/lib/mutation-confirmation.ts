import {createHash, timingSafeEqual} from 'node:crypto'

const REDACTED = '[REDACTED]'
const MAX_ORGANISATION_LENGTH = 128
const MAX_FIELD_LENGTH = 64
const MAX_SUMMARY_DEPTH = 2

type JsonValue = boolean | null | number | string | JsonValue[] | {[key: string]: JsonValue}

export interface MutationPreview {
  dryRun: true
  operation: string
  organisation: {tenantId: string; name?: string}
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
  tenantName?: string
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

function safeOrganisationText(value: string): string {
  return value.split(/[\u0000-\u001F\u007F-\u009F]/, 1)[0].slice(0, MAX_ORGANISATION_LENGTH)
}

function organisationPreview(tenantId: string, tenantName?: string): {tenantId: string; name?: string} {
  const organisation: {tenantId: string; name?: string} = {tenantId: safeOrganisationText(tenantId)}
  if (typeof tenantName === 'string' && tenantName !== '') {
    organisation.name = safeOrganisationText(tenantName)
  }
  return organisation
}

function redactedIfPresent(value: unknown): string | undefined {
  return value === undefined || value === null || value === '' ? undefined : REDACTED
}

function amountInMinorUnits(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.round(value * 100)
}

function lineCollectionTotal(lines: unknown[]): number | undefined {
  let minorUnits = 0
  let counted = 0
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue
    const item = line as Record<string, unknown>
    const quantity = typeof item.quantity === 'number' ? item.quantity : undefined
    const unitAmount = typeof item.unitAmount === 'number' ? item.unitAmount : undefined
    const derived = quantity === undefined || unitAmount === undefined
      ? undefined
      : amountInMinorUnits(quantity * unitAmount)
    const amount = amountInMinorUnits(item.lineAmount) ?? derived
    if (amount === undefined) continue
    minorUnits += amount
    counted += 1
  }
  return counted === 0 ? undefined : minorUnits / 100
}

function summariseList(values: unknown[]): Record<string, unknown> {
  const total = lineCollectionTotal(values)
  return total === undefined
    ? {count: values.length, content: REDACTED}
    : {count: values.length, total, content: REDACTED}
}

function journalLineTotals(lines: unknown[]): {debit: number; credit: number} {
  let debitMinorUnits = 0
  let creditMinorUnits = 0
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue
    const amount = amountInMinorUnits((line as Record<string, unknown>).lineAmount)
    if (amount === undefined) continue
    if (amount >= 0) debitMinorUnits += amount
    else creditMinorUnits -= amount
  }
  return {debit: debitMinorUnits / 100, credit: creditMinorUnits / 100}
}

/**
 * Show every field that will actually be sent. Scalars are shown so the
 * operator can check which invoice, account and amount the mutation hits;
 * collections are reduced to a count and a total so the preview stays bounded
 * and free-text line content never reaches the terminal.
 */
function summariseField(value: unknown, depth = 0): unknown {
  if (value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : REDACTED
  if (typeof value === 'string') return boundedText(value, MAX_FIELD_LENGTH)
  if (Array.isArray(value)) return summariseList(value)
  if (typeof value === 'object') {
    if (depth >= MAX_SUMMARY_DEPTH) return REDACTED
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, summariseField(item, depth + 1)]),
    )
  }
  return REDACTED
}

function boundedText(value: unknown, maxLength = 32): string | undefined {
  if (typeof value !== 'string') return undefined
  return value.split(/[\u0000-\u001F\u007F-\u009F]/, 1)[0].slice(0, maxLength)
}

export function mutationSummary(payload: Record<string, unknown>): Record<string, unknown> {
  return summariseField(payload) as Record<string, unknown>
}

export function manualJournalMutationSummary(journal: Record<string, unknown>): Record<string, unknown> {
  const lines = Array.isArray(journal.journalLines) ? journal.journalLines : []
  const {debit, credit} = journalLineTotals(lines)
  return {
    narration: redactedIfPresent(journal.narration),
    date: boundedText(journal.date),
    status: boundedText(journal.status),
    lineAmountTypes: boundedText(journal.lineAmountTypes),
    journalLines: {
      count: lines.length,
      debitTotal: debit,
      creditTotal: credit,
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
        organisation: organisationPreview(options.tenantId, options.tenantName),
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
  const lines = [
    'Dry run only; no Xero mutation was performed.',
    `Operation: ${preview.operation}`,
  ]
  if (preview.organisation.name) lines.push(`Organisation: ${preview.organisation.name}`)
  lines.push(
    `Organisation tenant ID: ${preview.organisation.tenantId}`,
    `Proposed: ${JSON.stringify(preview.proposed)}`,
    `Confirmation: ${preview.confirmation}`,
    preview.instruction,
  )
  return lines.join('\n')
}
