import { GlobalExceptionFilter } from './global-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AppException } from './app.exception';
import { RequestContextService } from '../context/request-context.service';

jest.mock('../context/request-context.service', () => ({
  RequestContextService: {
    getCorrelationId: jest.fn().mockReturnValue('mock-uuid-1234'),
  },
}));

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    mockRequest = {
      method: 'GET',
      url: '/test-route',
    };

    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
    
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('TEST 1: Production generic Error -> 500 -> generic safe response', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('database connection failed to postgres://user:password@10.0.0.1:5432/db');
    
    filter.catch(err, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', 'mock-uuid-1234');
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      correlationId: 'mock-uuid-1234',
    });
  });

  it('TEST 2: Production Prisma/internal DB Error -> safe 500', () => {
    process.env.NODE_ENV = 'production';
    const err = new AppException('DB_ERROR', 'PrismaClientInitializationError: P2002', 500);

    filter.catch(err, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
      correlationId: 'mock-uuid-1234',
    });
  });

  it('TEST 3: Production internal 4xx: relation "users" does not exist -> sanitized', () => {
    const error = new HttpException('relation "users" does not exist', 400);
    filter.catch(error, mockHost);
    
    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      code: 'HTTP_ERROR',
      message: 'An error occurred',
      correlationId: 'mock-uuid-1234',
    });
  });

  it('TEST 4: Production internal 4xx: ECONNREFUSED 10.0.0.5:5432 -> sanitized', () => {
    const error = new HttpException('ECONNREFUSED 10.0.0.5:5432', 400);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'An error occurred' }));
  });

  it('TEST 5: Production internal 4xx: P1001 -> sanitized', () => {
    const error = new HttpException('P1001', 400);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'An error occurred' }));
  });

  it('TEST 6: Production internal 4xx: ENOENT / filesystem path -> sanitized', () => {
    const error = new HttpException('ENOENT /var/app/secret.txt', 400);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'An error occurred' }));
  });

  it('TEST 7: Safe public validation message: Invalid email address -> preserved', () => {
    const error = new HttpException('Invalid email address', 400);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid email address' }));
  });

  it('TEST 8: Safe public business message: Workspace already exists -> preserved', () => {
    const error = new AppException('CONFLICT', 'Workspace already exists', 409);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Workspace already exists' }));
  });

  it('TEST 9: Safe public authorization: Forbidden -> preserved', () => {
    const error = new HttpException('Forbidden', 403);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Forbidden' }));
  });

  it('TEST 10: 429: Too many login attempts -> preserved', () => {
    const error = new HttpException('Too many login attempts', 429);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Too many login attempts' }));
  });

  it('TEST 12: NODE_ENV = development -> development diagnostics available', () => {
    process.env.NODE_ENV = 'development';
    const error = new HttpException('relation "users" does not exist', 400);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'relation "users" does not exist' }));
  });

  it('TEST 13: NODE_ENV = production -> safe', () => {
    process.env.NODE_ENV = 'production';
    const error = new HttpException('relation "users" does not exist', 400);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'An error occurred' }));
  });

  it('TEST 14: NODE_ENV = undefined -> SAFE, never raw internal error', () => {
    delete process.env.NODE_ENV;
    const error = new HttpException('relation "users" does not exist', 400);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'An error occurred' }));
  });

  it('TEST 15: NODE_ENV = "prod" -> SAFE', () => {
    process.env.NODE_ENV = 'prod';
    const error = new HttpException('relation "users" does not exist', 400);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'An error occurred' }));
  });

  it('TEST HTTP PATH: internal array error -> GlobalExceptionFilter -> client receives safe response', () => {
    process.env.NODE_ENV = 'production';
    const error = new HttpException(["ECONNREFUSED 10.0.0.5:5432"], 400);
    filter.catch(error, mockHost);
    
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'An error occurred' }));
  });
});
