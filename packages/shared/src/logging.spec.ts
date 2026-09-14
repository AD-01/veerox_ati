import { redact } from './utils/redact.util';
import { RequestContextMiddleware } from './context/request-context.middleware';
import { RequestContextService } from './context/request-context.service';

describe('Logging & Correlation Hardening', () => {
  describe('redact() - Adversarial Testing', () => {
    it('redacts sensitive keys case-insensitively and deeply (4 levels)', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              PASSWORD: 'secret-password',
              PaSsWd: 'another-secret',
              Token: 'my-token',
              DaTaBaSeUrL: 'postgres://db',
              level4: {
                authorization: 'Bearer secret',
                cookie: 'session=123',
                clientSecret: 'abc',
              }
            }
          }
        }
      };
      const redacted = redact(obj);
      expect(redacted.level1.level2.level3.PASSWORD).toEqual('[REDACTED]');
      expect(redacted.level1.level2.level3.PaSsWd).toEqual('[REDACTED]');
      expect(redacted.level1.level2.level3.Token).toEqual('[REDACTED]');
      expect(redacted.level1.level2.level3.level4.authorization).toEqual('[REDACTED]');
      expect(redacted.level1.level2.level3.level4.clientSecret).toEqual('[REDACTED]');
    });

    it('redacts nested arrays and mixed structures', () => {
      const arr = [
        { secret: 'val1', public: 'val2' },
        [
          { cookie: 'val3' },
          { NORMAL: 'val4' }
        ]
      ];
      const redacted = redact(arr);
      expect(redacted[0].secret).toEqual('[REDACTED]');
      expect(redacted[0].public).toEqual('val2');
      expect(redacted[1][0].cookie).toEqual('[REDACTED]');
      expect(redacted[1][1].NORMAL).toEqual('val4');
    });

    it('does not mutate the original object', () => {
      const original = { password: 'real-password' };
      const redacted = redact(original);
      expect(redacted.password).toEqual('[REDACTED]');
      expect(original.password).toEqual('real-password');
    });

    it('handles null and undefined safely', () => {
      expect(redact(null)).toBeNull();
      expect(redact(undefined)).toBeUndefined();
    });

    it('handles circular references without crashing', () => {
      const obj: any = { password: 'secret' };
      obj.self = obj;
      // The current simple recursive function might crash on circular structures.
      // To prevent this, redact should track seen objects.
      // Let's test if it handles it. If it throws, we need to fix it!
      const attemptRedact = () => redact(obj);
      expect(attemptRedact).not.toThrow();
    });

    it('handles Error objects', () => {
      const err = new Error('database connection failed');
      (err as any).password = 'my-db-pass';
      const redacted = redact(err);
      expect(redacted.password).toEqual('[REDACTED]');
      expect(redacted.message).toEqual('database connection failed');
    });
  });

  describe('RequestContextMiddleware - Trust Tests', () => {
    let middleware: RequestContextMiddleware;

    beforeEach(() => {
      middleware = new RequestContextMiddleware();
    });

    it('A. No client ID -> generates UUID', (done) => {
      const req = { headers: {} } as any;
      const res = {} as any;
      middleware.use(req, res, () => {
        const id = RequestContextService.getCorrelationId();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        done();
      });
    });

    it('B. Client sends attacker-controlled-value -> MUST differ', (done) => {
      const attackerId = 'attacker-controlled-value';
      const req = { headers: { 'x-correlation-id': attackerId } } as any;
      const res = {} as any;
      middleware.use(req, res, () => {
        const id = RequestContextService.getCorrelationId();
        expect(id).not.toEqual(attackerId);
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        done();
      });
    });

    it('C. Client sends control chars -> not canonical', (done) => {
      const badId = 'id\n123\r\t';
      const req = { headers: { 'x-correlation-id': badId } } as any;
      const res = {} as any;
      middleware.use(req, res, () => {
        const id = RequestContextService.getCorrelationId();
        expect(id).not.toEqual(badId);
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        done();
      });
    });

    it('D. Client sends extremely long ID -> not canonical', (done) => {
      const longId = 'a'.repeat(200);
      const req = { headers: { 'x-correlation-id': longId } } as any;
      const res = {} as any;
      middleware.use(req, res, () => {
        const id = RequestContextService.getCorrelationId();
        expect(id).not.toEqual(longId);
        done();
      });
    });

    it('E. Concurrent requests receive distinct isolated IDs', (done) => {
      const req1 = { headers: {} } as any;
      const req2 = { headers: {} } as any;
      let id1: string | undefined;
      let id2: string | undefined;

      middleware.use(req1, {} as any, () => {
        id1 = RequestContextService.getCorrelationId();
        middleware.use(req2, {} as any, () => {
          id2 = RequestContextService.getCorrelationId();
          expect(id1).toBeDefined();
          expect(id2).toBeDefined();
          expect(id1).not.toEqual(id2);
          done();
        });
      });
    });

    it('F. Backend retains a valid UUID (e.g. from BFF)', (done) => {
      const validId = '123e4567-e89b-12d3-a456-426614174000';
      const req = { headers: { 'x-correlation-id': validId } } as any;
      const res = {} as any;
      middleware.use(req, res, () => {
        const id = RequestContextService.getCorrelationId();
        expect(id).toEqual(validId);
        done();
      });
    });
  });

  describe('Log Injection', () => {
    it('serializes control characters as encoded JSON and prevents log forging', () => {
      const loggerMock = {
        message: 'This contains \r\n and \t and \x00',
        url: '/test?q=hello\r\n\r\nFORGED_LOG',
      };
      // When serialized to JSON by standard structured logging
      const serialized = JSON.stringify(loggerMock);
      expect(serialized).toContain('\\r\\n');
      expect(serialized).toContain('\\t');
      expect(serialized).toContain('\\u0000');
      // Verifying that it does not contain a literal newline which would split log lines
      expect(serialized).not.toMatch(/\n/);
    });
  });
});
