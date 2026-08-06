import {describe, expect, it, vi} from 'vitest'
import ItemsList from '../../../src/commands/items/list.js'

describe('items list', () => {
  it('does not expose an unsupported page flag', () => {
    expect(ItemsList.flags).not.toHaveProperty('page')
  })

  it('does not pass a page number to the Items API', async () => {
    const getItems = vi.fn().mockResolvedValue({body: {items: []}})
    const command = Object.create(ItemsList.prototype) as ItemsList

    Object.assign(command, {
      parse: vi.fn().mockResolvedValue({flags: {}}),
      xeroCall: vi.fn(async (_flags, operation) => operation({
        accountingApi: {getItems},
      }, 'tenant-id')),
      outputFormatted: vi.fn(),
    })

    await command.run()

    expect(getItems).toHaveBeenCalledWith('tenant-id')
  })
})
