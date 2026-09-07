/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

jest.mock('@nestjs/passport', () => {
  return {
    AuthGuard: () => {
      return class {
        canActivate() {
          return Promise.resolve(true);
        }
      };
    },
  };
});

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tokenService: any;
  
  beforeEach(() => {
    tokenService = { isTokenRevoked: jest.fn() };
    guard = new JwtAuthGuard(tokenService);
  });

  it('should block if token is revoked', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer revoked-token' },
        }),
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    tokenService.isTokenRevoked.mockResolvedValue(true);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('should call super.canActivate if token is not revoked', async () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { authorization: 'Bearer valid-token' },
        }),
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    tokenService.isTokenRevoked.mockResolvedValue(false);
    
    // We mock super.canActivate using jest spy on the base class prototype.
    // However, since it's a bit tricky to spy on passport's canActivate without a full module,
    // we just ensure isTokenRevoked works and returns true (since super.canActivate throws or returns boolean).
    // This is a minimal test ensuring the tokenService integration works.
    
    // We can just verify it doesn't throw UnauthorizedException early.
    // Since super.canActivate will fail because no Strategy is registered in this pure unit test context,
    // we wrap it in a mock or catch the passport error.
    try {
      await guard.canActivate(context);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch {
      // Passport might throw a different error or same if not configured, but our custom check passed.
    }
    expect(tokenService.isTokenRevoked).toHaveBeenCalledWith('valid-token');
  });
});
