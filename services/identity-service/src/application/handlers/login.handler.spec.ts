import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from '@nestjs/cqrs';
import { LoginHandler } from './login.handler';
import { LoginCommand } from '../commands/login.command';
import { USER_REPOSITORY } from '../ports/user.repository.interface';
import { TokenService } from '../../infrastructure/auth/token.service';

// Mock PasswordHash and EmailAddress
jest.mock('../../domain/value-objects/password-hash.value-object', () => ({
  PasswordHash: {
    hash: jest.fn().mockResolvedValue('mockHash'),
  }
}));

describe('LoginHandler', () => {
  let handler: LoginHandler;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userRepository: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tokenService: any;

  beforeEach(async () => {
    userRepository = {
      findByEmail: jest.fn(),
    };
    tokenService = {
      generateTokens: jest.fn().mockResolvedValue({ accessToken: 'mock', refreshToken: 'mock' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginHandler,
        { provide: USER_REPOSITORY, useValue: userRepository },
        { provide: TokenService, useValue: tokenService },
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        { provide: EventPublisher, useValue: { mergeObjectContext: (obj: any) => obj } },
      ],
    }).compile();

    handler = module.get<LoginHandler>(LoginHandler);
  });

  it('should throw if user not found', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    await expect(handler.execute(new LoginCommand('test@test.com', 'password', 'ip', 'dev'))).rejects.toThrow('Invalid credentials');
  });

  it('should authenticate user and generate tokens with ip and device', async () => {
    userRepository.findByEmail.mockResolvedValue({
      id: 'user-1',
      email: { value: 'test@test.com' },
      passwordHash: { compare: jest.fn().mockResolvedValue(true) }, // Mock PasswordHash.compare
      status: 'ACTIVE',
    });
    
    // We mock PasswordHash inside the handler via jest mock or skip the strict check in this mock
    // Actually the handler creates a command and the user aggregate handles password.
    // For this simple test, if `execute` succeeds we just check tokenService.
    const res = await handler.execute(new LoginCommand('test@test.com', 'password123', '127.0.0.1', 'device'));
    expect(res.accessToken).toBe('mock');
    expect(tokenService.generateTokens).toHaveBeenCalledWith(
      { sub: 'user-1', email: 'test@test.com' },
      '127.0.0.1',
      'device'
    );
  });
});
