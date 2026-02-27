/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException } from '@nestjs/common';
import { RegisterUseCase } from './register.use-case';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { TokenService } from '../infra/token.service';
import { EmailService } from '../infra/email.service';
import type { AuthAuditService } from '../infra/auth-audit.service';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

const buildPrisma = () =>
  ({
    client: {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    },
  }) as unknown as PrismaService;

const buildTokenService = () =>
  ({
    generateEmailToken: jest.fn().mockReturnValue('raw-token-abc'),
    hashEmailToken: jest.fn().mockReturnValue('hashed-token-abc'),
  }) as unknown as TokenService;

const buildEmailService = () =>
  ({
    sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  }) as unknown as EmailService;

const buildAuditService = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuthAuditService;

describe('RegisterUseCase', () => {
  it('registers a new user, creates email token, does NOT return accessToken', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();
    const emailService = buildEmailService();

    // email check → null; username check → null
    (prisma.client.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // email not taken
      .mockResolvedValueOnce(null); // username "test" not taken

    prisma.client.user.create = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
      username: 'test',
      role: 'USER',
    });

    const useCase = new RegisterUseCase(
      prisma,
      tokenService,
      emailService,
      buildAuditService(),
    );
    const result = await useCase.execute({
      email: 'test@example.com',
      password: 'password123',
    });

    expect(result).not.toHaveProperty('accessToken');
    expect(result).toHaveProperty('message');
    expect(result.user).toMatchObject({
      id: 'uuid-1',
      email: 'test@example.com',
      username: 'test',
    });
    expect(emailService.sendEmailVerification).toHaveBeenCalledWith(
      'test@example.com',
      'raw-token-abc',
    );
  });

  it('registers with explicit username', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();
    const emailService = buildEmailService();

    (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);
    prisma.client.user.create = jest.fn().mockResolvedValue({
      id: 'uuid-2',
      email: 'test2@example.com',
      username: 'myuser',
      role: 'USER',
    });

    const useCase = new RegisterUseCase(
      prisma,
      tokenService,
      emailService,
      buildAuditService(),
    );
    const result = await useCase.execute({
      email: 'test2@example.com',
      password: 'password123',
      username: 'MyUser',
    });

    expect(result.user.username).toBe('myuser');
  });

  it('throws 409 when email already exists', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();
    const emailService = buildEmailService();

    prisma.client.user.findUnique = jest.fn().mockResolvedValue({
      id: 'uuid-1',
      email: 'test@example.com',
    });

    const useCase = new RegisterUseCase(
      prisma,
      tokenService,
      emailService,
      buildAuditService(),
    );

    await expect(
      useCase.execute({ email: 'test@example.com', password: 'password123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('auto-generates username with suffix on collision', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();
    const emailService = buildEmailService();

    (prisma.client.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // email not taken
      .mockResolvedValueOnce({ id: 'other' }) // "facu" taken
      .mockResolvedValueOnce(null); // "facu2" available

    prisma.client.user.create = jest.fn().mockResolvedValue({
      id: 'uuid-3',
      email: 'facu@example.com',
      username: 'facu2',
      role: 'USER',
    });

    const useCase = new RegisterUseCase(
      prisma,
      tokenService,
      emailService,
      buildAuditService(),
    );
    await useCase.execute({
      email: 'facu@example.com',
      password: 'password123',
    });

    expect(prisma.client.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: 'facu2' }),
      }),
    );
  });

  it('pads short email local to 3 chars', async () => {
    const prisma = buildPrisma();
    const tokenService = buildTokenService();
    const emailService = buildEmailService();

    (prisma.client.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // email
      .mockResolvedValueOnce(null); // username "ab0" available

    prisma.client.user.create = jest.fn().mockResolvedValue({
      id: 'uuid-4',
      email: 'ab@x.com',
      username: 'ab0',
      role: 'USER',
    });

    const useCase = new RegisterUseCase(
      prisma,
      tokenService,
      emailService,
      buildAuditService(),
    );
    await useCase.execute({ email: 'ab@x.com', password: 'password123' });

    expect(prisma.client.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ username: 'ab0' }),
      }),
    );
  });
});
