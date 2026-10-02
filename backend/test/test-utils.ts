/**
 * Shared test utilities for Studio-docx Integration Tests
 *
 * Cung cấp:
 * - Bootstrap NestJS test app
 * - Helper login/register
 * - Seed data utilities
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import * as request from 'supertest';
import { hash } from 'bcryptjs';

let app: INestApplication;
let moduleRef: TestingModule;

/**
 * Khởi tạo NestJS application cho testing.
 * Gọi 1 lần duy nhất ở beforeAll() của mỗi test suite.
 */
export async function createTestApp(): Promise<INestApplication> {
  moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

export async function closeTestApp(): Promise<void> {
  if (app) await app.close();
}

export function getApp(): INestApplication {
  return app;
}

// ─── Auth Helpers ──────────────────────────────────────────────

export interface TestUser {
  accessToken: string;
  refreshCookie: string;
  accountId: number;
  customerId?: number;
  email: string;
}

function getCookie(response: request.Response, name: string): string {
  const setCookie = response.headers['set-cookie'];
  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookie = values.find((value) => value?.startsWith(`${name}=`));
  if (!cookie) throw new Error(`Response did not set cookie ${name}`);
  return cookie.split(';', 1)[0];
}

/**
 * Đăng ký tài khoản mới rồi đăng nhập lấy token.
 */
export async function registerAndLogin(
  email: string,
  password: string,
  fullName: string
): Promise<TestUser> {
  const server = app.getHttpServer();

  // Register
  await request(server)
    .post('/auth/register')
    .send({ email, password, fullName })
    .expect((res) => {
      if (res.status !== 201 && res.status !== 409) {
        throw new Error(`Register failed: ${res.status} ${JSON.stringify(res.body)}`);
      }
    });

  // Login
  const loginRes = await request(server).post('/auth/login').send({ email, password }).expect(201);

  // Auto-verify phone for test robustness
  if (loginRes.body.user.customerId) {
    const prisma = app.get(PrismaService);
    await prisma.customer_profiles.update({
      where: { customer_id: loginRes.body.user.customerId },
      data: { is_phone_verified: true }
    });
  }

  return {
    accessToken: loginRes.body.accessToken,
    refreshCookie: getCookie(loginRes, 'studydocs_refresh'),
    accountId: loginRes.body.user.accountId,
    customerId: loginRes.body.user.customerId,
    email
  };
}

/**
 * Đăng nhập tài khoản có sẵn (seed data hoặc đã tạo).
 */
export async function loginAs(email: string, password: string): Promise<TestUser> {
  const server = app.getHttpServer();

  const loginRes = await request(server).post('/auth/login').send({ email, password }).expect(201);

  return {
    accessToken: loginRes.body.accessToken,
    refreshCookie: getCookie(loginRes, 'studydocs_refresh'),
    accountId: loginRes.body.user.accountId,
    customerId: loginRes.body.user.customerId,
    email
  };
}

export async function ensureTestStaff(
  email: string,
  password: string,
  roleName: 'ADMIN' | 'MOD' | 'ACCOUNTANT'
): Promise<TestUser> {
  const prisma = app.get(PrismaService);
  const role = await prisma.roles.findUnique({ where: { name: roleName } });
  if (!role) throw new Error(`Missing test role ${roleName}`);
  const passwordHash = await hash(password, 12);

  await prisma.accounts.upsert({
    where: { email },
    create: {
      email,
      password_hash: passwordHash,
      status: 'ACTIVE',
      roles: { connect: { role_id: role.role_id } },
      staff_profiles: { create: { full_name: `${roleName} E2E` } }
    },
    update: {
      password_hash: passwordHash,
      status: 'ACTIVE',
      delete_at: null,
      roles: { connect: { role_id: role.role_id } }
    }
  });

  return loginAs(email, password);
}

export async function sessionPost(
  path: string,
  refreshCookie: string,
  expectedStatus: number
): Promise<request.Response> {
  const server = app.getHttpServer();
  const csrfResponse = await request(server).get('/auth/csrf').expect(200);
  const csrfCookie = getCookie(csrfResponse, 'studydocs_csrf');
  return request(server)
    .post(path)
    .set('Cookie', [refreshCookie, csrfCookie])
    .set('X-CSRF-Token', csrfResponse.body.csrfToken)
    .expect(expectedStatus);
}

/**
 * Tạo authenticated request helper.
 */
export function authGet(path: string, token: string) {
  return request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);
}

export function authPost(path: string, token: string) {
  return request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`);
}

export function authPatch(path: string, token: string) {
  return request(app.getHttpServer()).patch(path).set('Authorization', `Bearer ${token}`);
}

export function authPut(path: string, token: string) {
  return request(app.getHttpServer()).put(path).set('Authorization', `Bearer ${token}`);
}

export function authDelete(path: string, token: string) {
  return request(app.getHttpServer()).delete(path).set('Authorization', `Bearer ${token}`);
}
