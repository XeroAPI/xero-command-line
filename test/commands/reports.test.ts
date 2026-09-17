import {afterEach, describe, expect, it, vi} from 'vitest'
import {BaseCommand} from '../../src/base-command.js'
import ReportsBalanceSheet from '../../src/commands/reports/balance-sheet.js'
import ReportsProfitAndLoss from '../../src/commands/reports/profit-and-loss.js'

afterEach(() => vi.restoreAllMocks())

describe.each([
  ['balance sheet', ReportsBalanceSheet, 'getReportBalanceSheet'],
  ['profit and loss', ReportsProfitAndLoss, 'getReportProfitAndLoss'],
] as const)('%s report', (_name, ReportCommand, sdkMethod) => {
  it('maps standard-layout and payments-only to the matching Xero options', async () => {
    const report = vi.fn().mockResolvedValue({body: {reports: []}})
    const config = {runHook: vi.fn().mockResolvedValue({successes: []})} as never
    vi.spyOn(BaseCommand.prototype as never, 'xeroCall').mockImplementation(async (_flags, operation) =>
      operation({accountingApi: {[sdkMethod]: report}} as never, 'tenant-id'),
    )

    await new ReportCommand(['--client-id', 'client-id', '--standard-layout'], config).run()
    await new ReportCommand(['--client-id', 'client-id', '--payments-only'], config).run()

    expect(report.mock.calls.map((call) => call.slice(-2))).toEqual([
      [true, undefined],
      [undefined, true],
    ])
  })
})
