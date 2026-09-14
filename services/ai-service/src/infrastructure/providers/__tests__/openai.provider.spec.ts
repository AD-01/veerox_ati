import { OpenAIProvider } from '../openai.provider';
import { AppException } from '@veerox/shared';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(() => {
    provider = new OpenAIProvider();
    jest.clearAllMocks();
  });

  const request = {
    modelId: 'gpt-4',
    provider: 'OPENAI',
    modelName: 'gpt-4',
    systemPrompt: 'sys',
    userPrompt: 'user',
    temperature: 0.1,
  };
  const credentials = { OPENAI_API_KEY: 'test-key' };

  it('should timeout and abort after maximum retries', async () => {
    // Mock fetch to simulate AbortError timeout
    const fetchMock = jest.fn().mockRejectedValue(new Error('AbortError'));
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await expect(provider.infer(request, credentials)).rejects.toThrow(AppException);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 3 retries
  }, 10000);

  it('should retry on 429 and succeed', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ confidence: 0.9 }) } }],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        }),
      });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    const result = await provider.infer(request, credentials);
    expect(result.confidence).toBe(0.9);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);

  it('should retry on 500', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await expect(provider.infer(request, credentials)).rejects.toThrow(AppException);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 10000);

  it('should NOT retry on permanent 4xx (e.g. 401)', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' });
    global.fetch = fetchMock as unknown as typeof global.fetch;

    await expect(provider.infer(request, credentials)).rejects.toThrow(AppException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
