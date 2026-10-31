import { Prisma } from '@prisma/client';
import { DownloadsService } from './downloads.service';

describe('DownloadsService entitlement consumption', () => {
  it('atomically consumes one free entitlement and records the download', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ lock_result: '' }]),
      download_history: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({})
      },
      customer_profiles: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      documents: { update: jest.fn().mockResolvedValue({}) },
      order_items: { findFirst: jest.fn() },
      user_packages: { findFirst: jest.fn(), update: jest.fn() }
    };
    const prisma = {
      documents: {
        findFirst: jest.fn().mockResolvedValue({
          document_id: 9,
          seller_id: 99,
          file_url: 'docs/test.pdf',
          price: new Prisma.Decimal(0)
        })
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const storage = { getPresignedUrl: jest.fn().mockResolvedValue('https://signed.test/file') };
    const service = new DownloadsService(prisma as never, storage as never);

    await expect(
      service.requestDownload(
        {
          accountId: 1,
          customerId: 7,
          staffId: null,
          email: 'buyer@test',
          roleNames: ['customer'],
          status: 'ACTIVE'
        },
        9,
        '127.0.0.1'
      )
    ).resolves.toEqual(
      expect.objectContaining({ download_type: 'FREE_MONTHLY', expiresInSeconds: 300 })
    );
    expect(tx.customer_profiles.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { free_downloads_remaining: { decrement: 1 } } })
    );
    expect(tx.documents.update).toHaveBeenCalledTimes(1);
    expect(tx.download_history.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ download_type: 'FREE_MONTHLY' }) })
    );
  });

  it('does not consume another entitlement for a previously downloaded document', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      download_history: {
        findFirst: jest.fn().mockResolvedValue({
          download_type: 'PURCHASED',
          order_item_id: 11,
          user_package_id: null
        }),
        create: jest.fn().mockResolvedValue({})
      },
      customer_profiles: { updateMany: jest.fn() },
      documents: { update: jest.fn() }
    };
    const prisma = {
      documents: {
        findFirst: jest.fn().mockResolvedValue({
          document_id: 9,
          seller_id: 99,
          file_url: 'docs/test.pdf',
          price: new Prisma.Decimal(50_000)
        })
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
    };
    const service = new DownloadsService(
      prisma as never,
      { getPresignedUrl: jest.fn().mockResolvedValue('https://signed.test/file') } as never
    );

    const result = await service.requestDownload(
      {
        accountId: 1,
        customerId: 7,
        staffId: null,
        email: 'buyer@test',
        roleNames: ['customer'],
        status: 'ACTIVE'
      },
      9,
      '127.0.0.1'
    );

    expect(result.download_type).toBe('PURCHASED');
    expect(tx.customer_profiles.updateMany).not.toHaveBeenCalled();
    expect(tx.documents.update).not.toHaveBeenCalled();
    expect(tx.download_history.create).toHaveBeenCalledTimes(1);
  });
});
