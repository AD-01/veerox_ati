import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request = require('supertest');
import { MarketplaceModule } from '../marketplace.module';
import { PrismaService } from '@veerox/database';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';

describe('Phase 10-E Adversarial Commercial Governance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MarketplaceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = new JwtService({ secret: 'test-secret' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const createTestUserToken = (userId: string, roles: string[], permissions: string[]) => {
    return jwtService.sign({
      sub: userId,
      roles,
      permissions,
    });
  };

  it('should REJECT product publish if WorkspaceScopeGuard fails', async () => {
    const orgId = randomUUID();
    const workspaceId = randomUUID();
    const token = createTestUserToken(randomUUID(), ['User'], []); // Insufficient role

    const response = await request(app.getHttpServer())
      .post('/api/v1/marketplace/products')
      .set('Authorization', `Bearer ${token}`)
      .set('x-workspace-id', workspaceId)
      .set('x-organization-id', orgId)
      .send({
        name: 'Malicious Product',
        productType: 'EA',
        pricingModel: 'ONE_TIME',
        price: 100,
      });

    expect(response.status).toBe(HttpStatus.FORBIDDEN);
  });
});
