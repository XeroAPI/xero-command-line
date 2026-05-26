import {describe, it, expect, vi, beforeEach} from 'vitest'
import {getMimeType, validateUploadFile, AttachmentResource} from '../../src/lib/attachments.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
  return {...actual}
})

describe('getMimeType', () => {
  it('returns application/pdf for .pdf', () => {
    expect(getMimeType('invoice.pdf')).toBe('application/pdf')
  })

  it('returns image/png for .png', () => {
    expect(getMimeType('receipt.png')).toBe('image/png')
  })

  it('returns image/jpeg for .jpg', () => {
    expect(getMimeType('photo.jpg')).toBe('image/jpeg')
  })

  it('returns image/jpeg for .jpeg', () => {
    expect(getMimeType('photo.jpeg')).toBe('image/jpeg')
  })

  it('returns image/gif for .gif', () => {
    expect(getMimeType('anim.gif')).toBe('image/gif')
  })

  it('returns image/webp for .webp', () => {
    expect(getMimeType('img.webp')).toBe('image/webp')
  })

  it('returns application/xml for .xml', () => {
    expect(getMimeType('data.xml')).toBe('application/xml')
  })

  it('returns text/csv for .csv', () => {
    expect(getMimeType('data.csv')).toBe('text/csv')
  })

  it('returns text/plain for .txt', () => {
    expect(getMimeType('notes.txt')).toBe('text/plain')
  })

  it('is case-insensitive', () => {
    expect(getMimeType('INVOICE.PDF')).toBe('application/pdf')
  })

  it('throws for unknown extension', () => {
    expect(() => getMimeType('file.xyz')).toThrow('Unsupported file type: .xyz')
  })

  it('throws for no extension', () => {
    expect(() => getMimeType('noext')).toThrow('Unsupported file type: ')
  })
})

describe('validateUploadFile', () => {
  it('throws if file does not exist', () => {
    expect(() => validateUploadFile('/nonexistent/path/file.pdf')).toThrow('File not found: /nonexistent/path/file.pdf')
  })

  it('throws if file exceeds 25MB', () => {
    const tmpFile = path.join(os.tmpdir(), `xero-test-oversize-${Date.now()}.pdf`)
    fs.writeFileSync(tmpFile, 'x')
    const statSyncSpy = vi.spyOn(fs, 'statSync').mockReturnValue({size: 26 * 1024 * 1024} as fs.Stats)
    try {
      expect(() => validateUploadFile(tmpFile)).toThrow('File exceeds 25MB limit')
    } finally {
      statSyncSpy.mockRestore()
      fs.unlinkSync(tmpFile)
    }
  })

  it('does not throw for a valid small file', () => {
    const tmpFile = path.join(os.tmpdir(), `xero-test-valid-${Date.now()}.pdf`)
    fs.writeFileSync(tmpFile, 'x')
    try {
      expect(() => validateUploadFile(tmpFile)).not.toThrow()
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })
})

describe('uploadAttachment', () => {
  it('calls createInvoiceAttachmentByFileName with correct args', async () => {
    const {uploadAttachment} = await import('../../src/lib/attachments.js')
    const tmpFile = path.join(os.tmpdir(), `xero-upload-test-${Date.now()}.pdf`)
    fs.writeFileSync(tmpFile, 'fake pdf content')

    const mockCreate = vi.fn().mockResolvedValue({
      body: {attachments: [{attachmentID: 'att-1', fileName: path.basename(tmpFile)}]},
    })
    const xero = {accountingApi: {createInvoiceAttachmentByFileName: mockCreate}} as any

    await uploadAttachment(xero, 'tenant-1', 'invoice', 'inv-123', tmpFile, false)

    expect(mockCreate).toHaveBeenCalledWith(
      'tenant-1',
      'inv-123',
      path.basename(tmpFile),
      expect.any(Object), // ReadStream
      false,
      undefined,
    )
    // Don't unlink synchronously — the ReadStream opens the file asynchronously
    // and would throw ENOENT if we delete before it's GC'd. tmpdir is cleaned by OS.
  })

  it('calls createBankTransactionAttachmentByFileName for bankTransaction', async () => {
    const {uploadAttachment} = await import('../../src/lib/attachments.js')
    const tmpFile = path.join(os.tmpdir(), `xero-upload-bank-${Date.now()}.pdf`)
    fs.writeFileSync(tmpFile, 'fake content')

    const mockCreate = vi.fn().mockResolvedValue({
      body: {attachments: [{attachmentID: 'att-2', fileName: path.basename(tmpFile)}]},
    })
    const xero = {accountingApi: {createBankTransactionAttachmentByFileName: mockCreate}} as any

    await uploadAttachment(xero, 'tenant-1', 'bankTransaction', 'bt-456', tmpFile, false)

    expect(mockCreate).toHaveBeenCalledWith(
      'tenant-1',
      'bt-456',
      path.basename(tmpFile),
      expect.any(Object),
      undefined,
    )
    // Don't unlink synchronously — tmpdir is cleaned by OS.
  })
})

describe('listAttachments', () => {
  it('returns array of attachments from invoice', async () => {
    const {listAttachments} = await import('../../src/lib/attachments.js')
    const mockGet = vi.fn().mockResolvedValue({
      body: {
        attachments: [
          {attachmentID: 'att-1', fileName: 'receipt.pdf', mimeType: 'application/pdf', contentLength: 1024, url: 'https://example.com/att-1'},
        ],
      },
    })
    const xero = {accountingApi: {getInvoiceAttachments: mockGet}} as any

    const result = await listAttachments(xero, 'tenant-1', 'invoice', 'inv-123')

    expect(mockGet).toHaveBeenCalledWith('tenant-1', 'inv-123')
    expect(result).toHaveLength(1)
    expect(result[0].attachmentID).toBe('att-1')
    expect(result[0].fileName).toBe('receipt.pdf')
  })

  it('returns empty array when no attachments', async () => {
    const {listAttachments} = await import('../../src/lib/attachments.js')
    const mockGet = vi.fn().mockResolvedValue({body: {attachments: []}})
    const xero = {accountingApi: {getInvoiceAttachments: mockGet}} as any

    const result = await listAttachments(xero, 'tenant-1', 'invoice', 'inv-123')
    expect(result).toHaveLength(0)
  })
})

describe('downloadAttachment', () => {
  it('resolves filename via list then downloads by ID', async () => {
    const {downloadAttachment} = await import('../../src/lib/attachments.js')

    const mockList = vi.fn().mockResolvedValue({
      body: {
        attachments: [
          {attachmentID: 'att-1', fileName: 'invoice.pdf', mimeType: 'application/pdf'},
        ],
      },
    })
    const fakeBuffer = Buffer.from('PDF content')
    const mockGetById = vi.fn().mockResolvedValue({body: fakeBuffer})

    const xero = {
      accountingApi: {
        getInvoiceAttachments: mockList,
        getInvoiceAttachmentById: mockGetById,
      },
    } as any

    const result = await downloadAttachment(xero, 'tenant-1', 'invoice', 'inv-123', 'att-1')

    expect(mockList).toHaveBeenCalledWith('tenant-1', 'inv-123')
    expect(mockGetById).toHaveBeenCalledWith('tenant-1', 'inv-123', 'att-1', 'application/pdf')
    expect(result.fileName).toBe('invoice.pdf')
    expect(result.data).toEqual(fakeBuffer)
  })

  it('throws if attachmentId not found in list', async () => {
    const {downloadAttachment} = await import('../../src/lib/attachments.js')

    const mockList = vi.fn().mockResolvedValue({body: {attachments: []}})
    const xero = {accountingApi: {getInvoiceAttachments: mockList}} as any

    await expect(downloadAttachment(xero, 'tenant-1', 'invoice', 'inv-123', 'no-such-id'))
      .rejects.toThrow('Attachment not found: no-such-id')
  })
})
