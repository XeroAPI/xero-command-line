import {describe, expect, it, vi} from 'vitest'
import {encode} from '@toon-format/toon'
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

const toonReport = {
  reportName: 'Report',
  reportDate: '31 January 2025',
  rows: [
    {
      rows: [
        {
          cells: [
            {value: 'Cell 1'},
            {value: 'Cell 2'},
            {value: 'Cell 3'},
            {value: 'Cell 4'},
            {value: 'Cell 5'},
          ],
        },
      ],
    },
  ],
}

const toonReportCommands: Array<[string, ReportCommand, Record<string, unknown>, Record<string, unknown>[]]> = [
  ['aged payables', ReportsAgedPayables, {'contact-id': 'contact-id', toon: true}, [
    {date: 'Cell 1', reference: 'Cell 2', due: 'Cell 3', paid: 'Cell 4', credited: 'Cell 5'},
  ]],
  ['aged receivables', ReportsAgedReceivables, {'contact-id': 'contact-id', toon: true}, [
    {date: 'Cell 1', reference: 'Cell 2', due: 'Cell 3', paid: 'Cell 4', credited: 'Cell 5'},
  ]],
  ['balance sheet', ReportsBalanceSheet, {toon: true}, [{account: 'Cell 1', amount: 'Cell 2'}]],
  ['profit and loss', ReportsProfitAndLoss, {toon: true}, [{account: 'Cell 1', amount: 'Cell 2'}]],
  ['trial balance', ReportsTrialBalance, {toon: true}, [
    {account: 'Cell 1', debit: 'Cell 2', credit: 'Cell 3'},
  ]],
]

describe('report machine-readable output', () => {
  it.each(toonReportCommands)(
    '%s emits only the TOON document on stdout',
    async (_name, Command, flags, expectedRows) => {
      const command = new Command([], {}) as any
      vi.spyOn(command, 'parse').mockResolvedValue({flags})
      vi.spyOn(command, 'xeroCall').mockImplementation(async (_flags: unknown, operation: Function) =>
        operation({
          accountingApi: new Proxy({}, {
            get: () => vi.fn().mockResolvedValue({body: {reports: [toonReport]}}),
          }),
        }, 'tenant-id'),
      )
      const log = vi.spyOn(command, 'log').mockImplementation(() => undefined)

      await command.run()

      expect(log).toHaveBeenCalledTimes(1)
      expect(log.mock.calls[0]?.[0]).toBe(encode(expectedRows))
    },
  )
})
