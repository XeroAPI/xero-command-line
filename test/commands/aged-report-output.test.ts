import {describe, expect, it, vi} from 'vitest'
import ReportsAgedPayables from '../../src/commands/reports/aged-payables.js'
import ReportsAgedReceivables from '../../src/commands/reports/aged-receivables.js'

type AgedReportCommand = new (argv: string[], config: object) => {
  parse: (input: unknown) => Promise<unknown>
  run: () => Promise<void>
}

const report = {
  reportName: 'Aged report',
  rows: [{
    rows: [{
      cells: [
        {value: '2018-10-09T00:00:00'},
        {value: 'INV-0001'},
        {value: '2018-10-23T00:00:00'},
        {value: '181 days overdue'},
        {value: '250.00'},
        {value: '20.00'},
        {value: '30.00'},
        {value: '200.00'},
      ],
    }],
  }],
}

async function captureReportOutput(Command: AgedReportCommand, method: string) {
  const command = new Command([], {}) as any
  vi.spyOn(command, 'parse').mockResolvedValue({flags: {'contact-id': 'contact-id'}})
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

describe('aged report output', () => {
  it.each([
    ['aged payables', ReportsAgedPayables, 'getReportAgedPayablesByContact'],
    ['aged receivables', ReportsAgedReceivables, 'getReportAgedReceivablesByContact'],
  ] as Array<[string, AgedReportCommand, string]>)('%s retains every financial column', async (_name, Command, method) => {
    const [rows, columns] = await captureReportOutput(Command, method)

    expect(rows).toEqual([{
      date: '2018-10-09T00:00:00',
      reference: 'INV-0001',
      dueDate: '2018-10-23T00:00:00',
      aging: '181 days overdue',
      total: '250.00',
      paid: '20.00',
      credited: '30.00',
      due: '200.00',
    }])
    expect((columns as Array<{key: string; header: string}>).map(({key, header}) => ({key, header}))).toEqual([
      {key: 'date', header: 'Date'},
      {key: 'reference', header: 'Reference / Number'},
      {key: 'dueDate', header: 'Due Date'},
      {key: 'aging', header: 'Aging'},
      {key: 'total', header: 'Total'},
      {key: 'paid', header: 'Paid'},
      {key: 'credited', header: 'Credited'},
      {key: 'due', header: 'Due'},
    ])
  })
})
