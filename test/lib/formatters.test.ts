import {describe, it, expect} from 'vitest'
import {formatOutput, formatStatus, formatCurrency, formatDate} from '../../src/lib/formatters.js'

describe('formatOutput', () => {
  const data = [
    {name: 'Alice', age: 30, email: 'alice@example.com'},
    {name: 'Bob', age: 25, email: 'bob@example.com'},
  ]

  const columns = [
    {key: 'name', header: 'Name'},
    {key: 'age', header: 'Age'},
    {key: 'email', header: 'Email'},
  ]

  it('outputs JSON format', () => {
    const result = formatOutput(data, columns, 'json')
    const parsed = JSON.parse(result)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].name).toBe('Alice')
  })

  it('outputs CSV format with headers', () => {
    const result = formatOutput(data, columns, 'csv')
    const lines = result.split('\n')
    expect(lines[0]).toBe('Name,Age,Email')
    expect(lines[1]).toBe('Alice,30,alice@example.com')
    expect(lines[2]).toBe('Bob,25,bob@example.com')
  })

  it('escapes CSV values with commas', () => {
    const dataWithComma = [{name: 'Acme, Inc.', age: 10, email: 'a@b.com'}]
    const result = formatOutput(dataWithComma, columns, 'csv')
    expect(result).toContain('"Acme, Inc."')
  })

  it('neutralizes formula-like CSV strings without converting numeric values to text', () => {
    const formulaData = [
      {name: '=HYPERLINK("https://example.test", "click")', age: -42, email: ' \t@SUM(1,1)'},
    ]

    const result = formatOutput(formulaData, columns, 'csv')

    expect(result).toContain(`"'=HYPERLINK(""https://example.test"", ""click"")"`)
    expect(result).toContain('-42')
    expect(result).toContain('"\' \t@SUM(1,1)"')
  })

  it('round-trips alphanumeric codes with a leading sign unmodified', () => {
    const codeData = [{name: '-00123', age: 1, email: '+ABC123'}]

    const result = formatOutput(codeData, columns, 'csv')
    const lines = result.split('\n')

    expect(lines[1]).toBe('-00123,1,+ABC123')
  })

  it('always neutralizes values starting with an equals sign', () => {
    const equalsData = [{name: '=00123', age: 2, email: 'a@b.com'}]

    const result = formatOutput(equalsData, columns, 'csv')

    expect(result).toContain(`'=00123`)
  })

  it('outputs table format', () => {
    const result = formatOutput(data, columns, 'table')
    expect(result).toContain('Alice')
    expect(result).toContain('Bob')
  })

  it('shows message for empty data in table format', () => {
    const result = formatOutput([], columns, 'table')
    expect(result).toContain('No results found')
  })

  it('outputs TOON format', () => {
    const result = formatOutput(data, columns, 'toon')
    expect(result).toBeTruthy()
    expect(result).toContain('Alice')
    expect(result).toContain('Bob')
  })
})

describe('formatCurrency', () => {
  it('formats numbers to 2 decimal places', () => {
    expect(formatCurrency(1234.5)).toBe('1,234.50')
    expect(formatCurrency(0)).toBe('0.00')
    expect(formatCurrency(99.99)).toBe('99.99')
  })

  it('handles string numbers', () => {
    expect(formatCurrency('1234.5')).toBe('1,234.50')
  })

  it('returns empty string for null/undefined', () => {
    expect(formatCurrency(null)).toBe('')
    expect(formatCurrency(undefined)).toBe('')
  })

  it('returns original value for NaN', () => {
    expect(formatCurrency('not-a-number')).toBe('not-a-number')
  })
})

describe('formatDate', () => {
  it('formats ISO date strings', () => {
    expect(formatDate('2025-06-15T00:00:00')).toBe('2025-06-15')
    expect(formatDate('2025-06-15')).toBe('2025-06-15')
  })

  it('formats Xero /Date()/ format', () => {
    // Jan 1, 2025 00:00:00 UTC = 1735689600000
    expect(formatDate('/Date(1735689600000+0000)/')).toBe('2025-01-01')
  })

  it('formats Date objects', () => {
    const date = new Date('2025-06-15')
    expect(formatDate(date)).toBe('2025-06-15')
  })

  it('returns empty string for falsy values', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })
})

describe('formatStatus', () => {
  it('returns a string for known statuses', () => {
    // Just checking it doesn't throw and returns something
    expect(formatStatus('DRAFT')).toBeTruthy()
    expect(formatStatus('PAID')).toBeTruthy()
    expect(formatStatus('VOIDED')).toBeTruthy()
  })

  it('handles unknown statuses', () => {
    expect(formatStatus('UNKNOWN')).toBeTruthy()
  })
})
