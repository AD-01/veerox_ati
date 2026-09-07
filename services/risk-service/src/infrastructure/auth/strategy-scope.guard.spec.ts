import { StrategyScopeGuard } from './strategy-scope.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('StrategyScopeGuard', () => {
  let guard: StrategyScopeGuard;

  beforeEach(() => {
    guard = new StrategyScopeGuard();
  });

  it('should return false if no user is present', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should throw ForbiddenException if target organizationId is not in params or body', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: '1' },
          params: {},
          body: {},
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Organization ID context is missing from request');
  });

  it('should throw ForbiddenException if user lacks access to organizationId', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            userId: '1',
            roles: [{ organizationId: 'other-org' }],
          },
          params: { organizationId: 'target-org' },
          body: {},
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('User does not have access to this organization');
  });

  it('should return true if user has access to organizationId in params', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            userId: '1',
            roles: [{ organizationId: 'target-org' }],
          },
          params: { organizationId: 'target-org' },
          body: {},
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });
});
