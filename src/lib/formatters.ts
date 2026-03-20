import Table from 'cli-table3'
import chalk from 'chalk'

export type OutputFormat = 'table' | 'json' | 'csv'

export function formatOutput(
  data: Record<string, unknown>[],
  columns: {key: string; header: string; format?: (value: unknown) => string}[],
  format: OutputFormat,
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2)
    case 'csv':
      return formatCsv(data, columns)
    default:
      return formatTable(data, columns)
  }
}

function formatTable(
  data: Record<string, unknown>[],
  columns: {key: string; header: string; format?: (value: unknown) => string}[],
): string {
  if (data.length === 0) {
    return chalk.yellow('No results found.')
  }

  const table = new Table({
    head: columns.map(col => chalk.cyan(col.header)),
    style: {head: [], border: []},
    wordWrap: true,
  })

  for (const row of data) {
    table.push(
      columns.map(col => {
        const value = getNestedValue(row, col.key)
        if (col.format) return col.format(value)
        return String(value ?? '')
      }),
    )
  }

  return table.toString()
}

function formatCsv(
  data: Record<string, unknown>[],
  columns: {key: string; header: string}[],
): string {
  const header = columns.map(col => escapeCsv(col.header)).join(',')
  const rows = data.map(row =>
    columns.map(col => escapeCsv(String(getNestedValue(row, col.key) ?? ''))).join(','),
  )
  return [header, ...rows].join('\n')
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

export function formatStatus(status: string): string {
  const statusColors: Record<string, (text: string) => string> = {
    DRAFT: chalk.gray,
    SUBMITTED: chalk.blue,
    AUTHORISED: chalk.green,
    AUTHORIZED: chalk.green,
    PAID: chalk.green,
    VOIDED: chalk.red,
    DELETED: chalk.red,
    ARCHIVED: chalk.yellow,
    ACTIVE: chalk.green,
    SENT: chalk.blue,
    ACCEPTED: chalk.green,
    DECLINED: chalk.red,
    INVOICED: chalk.green,
  }

  const colorFn = statusColors[status] ?? chalk.white
  return colorFn(status)
}

export function formatCurrency(amount: unknown): string {
  if (amount === null || amount === undefined) return ''
  const num = Number(amount)
  if (Number.isNaN(num)) return String(amount)
  return num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})
}

export function formatDate(date: unknown): string {
  if (!date) return ''
  if (typeof date === 'string') {
    // Handle Xero's /Date(...)/ format
    const msMatch = /\/Date\((\d+)\+\d+\)\//.exec(date)
    if (msMatch) {
      return new Date(Number(msMatch[1])).toISOString().split('T')[0]
    }
    // Already a date string
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
      return date.split('T')[0]
    }
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0]
  }
  return String(date)
}
