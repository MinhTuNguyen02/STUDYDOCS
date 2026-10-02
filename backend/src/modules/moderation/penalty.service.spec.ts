import { PenaltyService } from './penalty.service';
import { PrismaService } from '../../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('PenaltyService', () => {
  let penaltyService: PenaltyService;
  let prismaMock: any;
  let notificationsMock: any;

  beforeEach(() => {
    prismaMock = {
      customer_profiles: {
        findUnique: jest.fn()
      },
      audit_logs: {
        count: jest.fn(),
        create: jest.fn()
      },
      $transaction: jest.fn(async (cb) => {
        return cb(prismaMock);
      }),
      accounts: {
        update: jest.fn()
      },
      user_sessions: {
        updateMany: jest.fn()
      }
    };

    notificationsMock = {
      notify: jest.fn().mockResolvedValue(true)
    };

    penaltyService = new PenaltyService(
      prismaMock as unknown as PrismaService,
      notificationsMock as unknown as NotificationsService
    );
  });

  it('should do nothing if profile is not found', async () => {
    prismaMock.customer_profiles.findUnique.mockResolvedValue(null);

    await penaltyService.evaluateUserViolations(999);

    expect(prismaMock.audit_logs.count).not.toHaveBeenCalled();
    expect(notificationsMock.notify).not.toHaveBeenCalled();
  });

  it('should issue a warning when violation count is exactly 3', async () => {
    prismaMock.customer_profiles.findUnique.mockResolvedValue({
      customer_id: 1,
      account_id: 10,
      accounts: { status: 'ACTIVE' }
    });
    prismaMock.audit_logs.count.mockResolvedValue(3);

    await penaltyService.evaluateUserViolations(1);

    expect(prismaMock.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        account_id: 10,
        action: 'UPLOAD_WARNING'
      })
    });
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 10,
        type: 'SYSTEM',
        title: 'Cảnh báo vi phạm tải tài liệu'
      })
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('should ban account and revoke sessions when violations reach 5 or more', async () => {
    prismaMock.customer_profiles.findUnique.mockResolvedValue({
      customer_id: 1,
      account_id: 10,
      accounts: { status: 'ACTIVE' }
    });
    prismaMock.audit_logs.count.mockResolvedValue(5);

    await penaltyService.evaluateUserViolations(1);

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.accounts.update).toHaveBeenCalledWith({
      where: { account_id: 10 },
      data: { status: 'BANNED', banned_until: null }
    });
    expect(prismaMock.user_sessions.updateMany).toHaveBeenCalledWith({
      where: { account_id: 10, is_revoked: false },
      data: { is_revoked: true }
    });
    expect(notificationsMock.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 10,
        type: 'ACCOUNT_BANNED'
      })
    );
  });

  it('should not re-ban if already banned', async () => {
    prismaMock.customer_profiles.findUnique.mockResolvedValue({
      customer_id: 1,
      account_id: 10,
      accounts: { status: 'BANNED' }
    });
    prismaMock.audit_logs.count.mockResolvedValue(6);

    await penaltyService.evaluateUserViolations(1);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(notificationsMock.notify).not.toHaveBeenCalled();
  });
});
