import { ValidationPipe } from '@nestjs/common';
import { SubmitManualTradeRequestDto } from '@veerox/contracts';
import 'reflect-metadata';

async function test() {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const testCases = [
    { name: 'valid', data: { accountId: 'a', symbolId: 'b', tradeDirection: 'BUY', requestedSize: 10, orderType: 'MARKET', maxDeviation: 5 } },
    { name: 'maxDeviation="invalid"', data: { accountId: 'a', symbolId: 'b', tradeDirection: 'BUY', requestedSize: 10, orderType: 'MARKET', maxDeviation: 'invalid' } },
    { name: 'maxDeviation=NaN', data: { accountId: 'a', symbolId: 'b', tradeDirection: 'BUY', requestedSize: 10, orderType: 'MARKET', maxDeviation: NaN } },
    { name: 'maxDeviation="NaN"', data: { accountId: 'a', symbolId: 'b', tradeDirection: 'BUY', requestedSize: 10, orderType: 'MARKET', maxDeviation: 'NaN' } },
    { name: 'maxDeviation=Infinity', data: { accountId: 'a', symbolId: 'b', tradeDirection: 'BUY', requestedSize: 10, orderType: 'MARKET', maxDeviation: Infinity } },
    { name: 'requestedSize="invalid"', data: { accountId: 'a', symbolId: 'b', tradeDirection: 'BUY', requestedSize: 'invalid', orderType: 'MARKET' } },
    { name: 'requestedSize="10"', data: { accountId: 'a', symbolId: 'b', tradeDirection: 'BUY', requestedSize: '10', orderType: 'MARKET' } },
    { name: 'tradeDirection="buy"', data: { accountId: 'a', symbolId: 'b', tradeDirection: 'buy', requestedSize: 10, orderType: 'MARKET' } },
  ];

  for (const tc of testCases) {
    try {
      const result = await pipe.transform(tc.data, {
        type: 'body',
        metatype: SubmitManualTradeRequestDto,
      });
      console.log(`[PASS] ${tc.name} -> Resolved to:`, result);
    } catch (e: any) {
      console.log(`[REJECT] ${tc.name} -> Rejected with:`, e?.response?.message || e.message);
    }
  }
}

test().catch(console.error);
