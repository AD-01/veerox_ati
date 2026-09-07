import { AppException } from './app.exception';
describe('AppException', () => {
  it('should create an error with code and message', () => {
    const err = new AppException('TEST_ERR', 'Test error', 400);
    expect(err.code).toBe('TEST_ERR');
    expect(err.message).toBe('Test error');
    expect(err.statusCode).toBe(400);
  });
});
