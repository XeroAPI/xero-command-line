import {describe, expect, it, vi} from 'vitest'
import ReportsBalanceSheet from '../../../src/commands/reports/balance-sheet.js'
import ReportsProfitAndLoss from '../../../src/commands/reports/profit-and-loss.js'

describe('report boolean flags', () => {
  it('passes payments-only to the Balance Sheet paymentsOnly parameter', async () => {
    const getReportBalanceSheet = vi.fn().mockResolvedValue({body: {reports: [{}]}})
    const command = Object.create(ReportsBalanceSheet.prototype) as ReportsBalanceSheet

    Object.assign(command, {
      parse: vi.fn().mockResolvedValue({flags: {
        'payments-only': true,
        'standard-layout': false,
      }}),
      xeroCall: vi.fn(async (_flags, operation) => operation({
        accountingApi: {getReportBalanceSheet},
      }, 'tenant-id')),
      log: vi.fn(),
      outputFormatted: vi.fn(),
    })

    await command.run()

    expect(getReportBalanceSheet).toHaveBeenCalledWith(
      'tenant-id',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    )
  })

  it('passes payments-only to the Profit and Loss paymentsOnly parameter', async () => {
    const getReportProfitAndLoss = vi.fn().mockResolvedValue({body: {reports: [{}]}})
    const command = Object.create(ReportsProfitAndLoss.prototype) as ReportsProfitAndLoss

    Object.assign(command, {
      parse: vi.fn().mockResolvedValue({flags: {
        'payments-only': true,
        'standard-layout': false,
      }}),
      xeroCall: vi.fn(async (_flags, operation) => operation({
        accountingApi: {getReportProfitAndLoss},
      }, 'tenant-id')),
      log: vi.fn(),
      outputFormatted: vi.fn(),
    })

    await command.run()

    expect(getReportProfitAndLoss).toHaveBeenCalledWith(
      'tenant-id',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    )
  })
})
