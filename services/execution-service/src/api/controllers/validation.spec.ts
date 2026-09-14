import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { SubmitManualTradeRequestDto } from '@veerox/contracts';

describe('Validation API Input Hardening (Phase 10-F-03-A)', () => {
  let target: ValidationPipe;

  beforeEach(() => {
    target = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: (errors) => {
        const firstError = errors[0];
        const message = firstError.constraints ? Object.values(firstError.constraints).join(', ') : 'Validation failed';
        return new Error(message);
      },
    });
  });

  it('should accept valid financial input', async () => {
    const validDto = {
      accountId: 'acc-1',
      symbolId: 'sym-1',
      tradeDirection: 'BUY',
      requestedSize: 100,
      orderType: 'MARKET',
      maxDeviation: 5.5,
    };
    
    // transform method runs validation
    const result = await target.transform(validDto, {
      type: 'body',
      metatype: SubmitManualTradeRequestDto,
    });
    
    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(SubmitManualTradeRequestDto);
    expect(result.requestedSize).toBe(100);
  });

  it('should reject "invalid" numeric string that coerces to NaN (maxDeviation)', async () => {
    const invalidDto = {
      accountId: 'acc-1',
      symbolId: 'sym-1',
      tradeDirection: 'BUY',
      requestedSize: 100,
      orderType: 'MARKET',
      maxDeviation: 'invalid', // Attack vector
    };

    await expect(
      target.transform(invalidDto, {
        type: 'body',
        metatype: SubmitManualTradeRequestDto,
      })
    ).rejects.toThrow('maxDeviation must be a number conforming to the specified constraints');
  });

  it('should reject NaN explicitly', async () => {
    const invalidDto = {
      accountId: 'acc-1',
      symbolId: 'sym-1',
      tradeDirection: 'BUY',
      requestedSize: NaN,
      orderType: 'MARKET',
    };

    await expect(
      target.transform(invalidDto, {
        type: 'body',
        metatype: SubmitManualTradeRequestDto,
      })
    ).rejects.toThrow();
  });

  it('should reject Infinity', async () => {
    const invalidDto = {
      accountId: 'acc-1',
      symbolId: 'sym-1',
      tradeDirection: 'BUY',
      requestedSize: Infinity,
      orderType: 'MARKET',
    };

    await expect(
      target.transform(invalidDto, {
        type: 'body',
        metatype: SubmitManualTradeRequestDto,
      })
    ).rejects.toThrow();
  });

  it('should reject negative values where prohibited (requestedSize)', async () => {
    const invalidDto = {
      accountId: 'acc-1',
      symbolId: 'sym-1',
      tradeDirection: 'BUY',
      requestedSize: -50, // Should be min 0.01
      orderType: 'MARKET',
    };

    await expect(
      target.transform(invalidDto, {
        type: 'body',
        metatype: SubmitManualTradeRequestDto,
      })
    ).rejects.toThrow('requestedSize must not be less than 0.01');
  });

  it('should reject unexpected extra DTO fields', async () => {
    const invalidDto = {
      accountId: 'acc-1',
      symbolId: 'sym-1',
      tradeDirection: 'BUY',
      requestedSize: 100,
      orderType: 'MARKET',
      maliciousField: true, // Not allowed by forbidNonWhitelisted
    };

    await expect(
      target.transform(invalidDto, {
        type: 'body',
        metatype: SubmitManualTradeRequestDto,
      })
    ).rejects.toThrow('property maliciousField should not exist');
  });

  it('should reject wrong types for enums', async () => {
    const invalidDto = {
      accountId: 'acc-1',
      symbolId: 'sym-1',
      tradeDirection: 'LONG', // Invalid enum value
      requestedSize: 100,
      orderType: 'MARKET',
    };

    await expect(
      target.transform(invalidDto, {
        type: 'body',
        metatype: SubmitManualTradeRequestDto,
      })
    ).rejects.toThrow('tradeDirection must be one of the following values: BUY, SELL');
  });

  it('should reject object masquerading as a number', async () => {
    const invalidDto = {
      accountId: 'acc-1',
      symbolId: 'sym-1',
      tradeDirection: 'BUY',
      requestedSize: { gte: 10 }, // Attack vector
      orderType: 'MARKET',
    };

    await expect(
      target.transform(invalidDto, {
        type: 'body',
        metatype: SubmitManualTradeRequestDto,
      })
    ).rejects.toThrow('requestedSize must be a number');
  });
});
