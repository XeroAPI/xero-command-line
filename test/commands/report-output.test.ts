import {describe, expect, it, vi} from 'vitest'
import ReportsAgedPayables from '../../src/commands/reports/aged-payables.js'
import ReportsAgedReceivables from '../../src/commands/reports/aged-receivables.js'
import ReportsBalanceSheet from '../../src/commands/reports/balance-sheet.js'
import ReportsProfitAndLoss from '../../src/commands/reports/profit-and-loss.js'
import ReportsTrialBalance from '../../src/commands/reports/trial-balance.js'

type ReportCommand = new (argv: string[], config: object) => {
  parse: (input: unknown) => Promise<unknown>
  run: () => Promise<void>
}

const reportCommands: Array<[string, ReportCommand, Record<string, unknown>]> = [
  ['aged payables', ReportsAgedPayables, {'contact-id': 'contact-id', toon: true}],
  ['aged receivables', ReportsAgedReceivables, {'contact-id': 'contact-id', toon: true}],
  ['balance sheet', ReportsBalanceSheet, {toon: true}],
  ['profit and loss', ReportsProfitAndLoss, {toon: true}],
  ['trial balance', ReportsTrialBalance, {toon: true}],
]

describe('report output formats', () => {
  it.each(reportCommands)('%s passes --toon to the formatter', async (_name, Command, flags) => {
    const command = new Command([], {}) as any
    vi.spyOn(command, 'parse').mockResolvedValue({flags})
    vi.spyOn(command, 'xeroCall').mockImplementation(async (_flags: unknown, operation: Function) =>
      operation({
        accountingApi: new Proxy({}, {
          get: () => vi.fn().mockResolvedValue({body: {reports: [{reportName: 'Report', rows: []}]}}),
        }),
      }, 'tenant-id'),
    )
    vi.spyOn(command, 'log').mockImplementation(() => undefined)
    const outputFormatted = vi.spyOn(command, 'outputFormatted').mockImplementation(() => undefined)

    await command.run()

    expect(outputFormatted.mock.calls[0]?.[2]).toEqual(flags)
  })
})
