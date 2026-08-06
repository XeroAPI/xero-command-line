import {describe, expect, it, vi} from 'vitest'
import ReportsBalanceSheet from '../../src/commands/reports/balance-sheet.js'
import ReportsProfitAndLoss from '../../src/commands/reports/profit-and-loss.js'

type FinancialReportCommand = new (argv: string[], config: object) => {
  parse: (input: unknown) => Promise<unknown>
  run: () => Promise<void>
}

const report = {
  reportName: 'Financial report',
  rows: [
    {
      rowType: 'Header',
      cells: [
        {value: ''},
        {value: '30 Apr 2026'},
        {value: '31 Mar 2026'},
        {value: '28 Feb 2026'},
      ],
    },
    {
      rowType: 'Section',
      title: 'Income',
      rows: [{
        rowType: 'Row',
        cells: [
          {value: 'Sales'},
          {value: '100.00'},
          {value: '90.00'},
          {value: '80.00'},
        ],
      }],
    },
  ],
}

async function captureReportOutput(Command: FinancialReportCommand, method: string) {
  const command = new Command([], {}) as any
  vi.spyOn(command, 'parse').mockResolvedValue({flags: {periods: 3}})
  vi.spyOn(command, 'xeroCall').mockImplementation(async (_flags: unknown, operation: Function) =>
    operation({
      accountingApi: {
        [method]: vi.fn().mockResolvedValue({body: {reports: [report]}}),
      },
    }, 'tenant-id'),
  )
  vi.spyOn(command, 'log').mockImplementation(() => undefined)
  const outputFormatted = vi.spyOn(command, 'outputFormatted').mockImplementation(() => undefined)

  await command.run()
  return outputFormatted.mock.calls[0]
}

describe('multi-period financial report output', () => {
  it.each([
    ['balance sheet', ReportsBalanceSheet, 'getReportBalanceSheet'],
    ['profit and loss', ReportsProfitAndLoss, 'getReportProfitAndLoss'],
  ] as Array<[string, FinancialReportCommand, string]>)('%s retains every requested period', async (_name, Command, method) => {
    const [rows, columns] = await captureReportOutput(Command, method)

    expect(rows).toEqual([
      {account: '--- Income ---'},
      {
        account: 'Sales',
        period0: '100.00',
        period1: '90.00',
        period2: '80.00',
      },
    ])
    expect((columns as Array<{key: string; header: string}>).map(({key, header}) => ({key, header}))).toEqual([
      {key: 'account', header: 'Account'},
      {key: 'period0', header: '30 Apr 2026'},
      {key: 'period1', header: '31 Mar 2026'},
      {key: 'period2', header: '28 Feb 2026'},
    ])
  })
})
