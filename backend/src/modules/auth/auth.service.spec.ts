import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const createService = (account: unknown) => {
    const prisma = {
      accounts: { findUnique: jest.fn().mockResolvedValue(account) }
    };
    const service = new AuthService(
      prisma as never,
      { signAsync: jest.fn() } as never,
      { get: jest.fn(), getOrThrow: jest.fn() } as never,
      {} as never,
      {} as never
    );
    return { service, prisma };
  };

  it('normalizes email and rejects an unknown account without leaking existence', async () => {
    const { service, prisma } = createService(null);

    await expect(
      service.login({ email: '  USER@Example.COM ', password: 'ValidPassword123!' })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.accounts.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'user@example.com' } })
    );
  });

  it('never accepts a legacy plaintext password hash', async () => {
    const { service } = createService({
      account_id: 1,
      email: 'user@example.com',
      password_hash: 'ValidPassword123!',
      delete_at: null,
      status: 'ACTIVE',
      banned_until: null,
      customer_profiles: null,
      staff_profiles: null,
      roles: { name: 'customer' }
    });

    await expect(
      service.login({ email: 'user@example.com', password: 'ValidPassword123!' })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
