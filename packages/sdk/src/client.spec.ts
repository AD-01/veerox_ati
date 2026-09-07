import { ConnectorClient } from './client';
import { ConnectorCommandDto } from './types';

describe('ConnectorClient SDK Protocol', () => {
  let client: ConnectorClient;
  const config = {
    baseUrl: 'http://localhost:3000',
    connectorId: 'conn-123',
    organizationId: 'org-123',
    workspaceId: 'ws-123',
    clientSecret: 'secret',
  };

  beforeEach(() => {
    client = new ConnectorClient(config);
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    client.disconnect();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  describe('Test A: Authenticate -> Heartbeat -> Connected', () => {
    it('should successfully connect and send heartbeat', async () => {
      const fetchMock = global.fetch as jest.Mock;
      
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ success: true, data: { accessToken: 'valid-token' } }),
      }));

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ success: true }),
      }));

      await client.connect('1.0.0');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3000/api/v1/auth/connector', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ connectorId: 'conn-123', clientSecret: 'secret' }),
      }));
      expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3000/organizations/org-123/workspaces/ws-123/connectors/conn-123/heartbeat', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer valid-token' },
      }));
    });
  });

  describe('Test B: Authenticate -> Poll -> Receive Command -> Respond', () => {
    it('should handle a command loop', async () => {
      const fetchMock = global.fetch as jest.Mock;
      
      // Auth
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ success: true, data: { accessToken: 'valid-token' } }),
      }));

      const command: ConnectorCommandDto = {
        id: 'cmd-1',
        connectorId: 'conn-123',
        commandType: 'PING',
        payloadJson: '{}',
        status: 'PENDING',
        retries: 0,
        createdAt: new Date().toISOString(),
      };

      // Poll 1 (Returns command)
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ command }),
      }));

      // Response 1
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ success: true }),
      }));

      // Poll 2 (Empty)
      fetchMock.mockImplementation(async () => ({
        ok: true,
        json: async () => ({ command: null }),
      }));

      await client.authenticate();

      const handler = jest.fn().mockResolvedValue({
        responseCode: 'SUCCESS',
        payloadJson: '{"pong": true}',
      });

      client.startPolling(handler, 1000);

      // Advance to process the first poll
      await jest.advanceTimersByTimeAsync(10);
      
      expect(handler).toHaveBeenCalledWith(command);
      expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/organizations/org-123/workspaces/ws-123/connectors/conn-123/commands/cmd-1/response', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ responseCode: 'SUCCESS', payloadJson: '{"pong": true}' }),
      }));
    });
  });

  describe('Test F: Credential revoked -> reconnect rejected', () => {
    it('should fail closed when authentication fails', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        statusText: 'Unauthorized',
      }));

      await expect(client.authenticate()).rejects.toThrow('Authentication failed: Unauthorized');
      
      // Attempt to heartbeat without token should return immediately without fetching
      fetchMock.mockClear();
      await client.heartbeat();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Test G: Connector disabled -> operations rejected', () => {
    it('should stop polling if token becomes invalid during loop', async () => {
      const fetchMock = global.fetch as jest.Mock;
      
      // Auth
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ success: true, data: { accessToken: 'valid-token' } }),
      }));
      await client.authenticate();

      // Poll returns 401
      fetchMock.mockImplementationOnce(async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      }));

      const handler = jest.fn();
      client.startPolling(handler, 1000);
      
      await jest.advanceTimersByTimeAsync(10);
      
      expect(handler).not.toHaveBeenCalled();
      
      // Polling should have stopped internally (token wiped)
      fetchMock.mockClear();
      await jest.advanceTimersByTimeAsync(2000);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Test H: Graceful shutdown -> no continuing heartbeat/polling', () => {
    it('disconnect() should clear intervals and prevent future fetches', async () => {
      const fetchMock = global.fetch as jest.Mock;
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ success: true, data: { accessToken: 'valid-token' } }),
      }));
      fetchMock.mockImplementation(async () => ({
        ok: true,
        json: async () => ({ command: null }),
      }));

      await client.authenticate();
      
      client.startHeartbeat(1000);
      client.startPolling(jest.fn(), 1000);

      fetchMock.mockClear();
      client.disconnect();

      await jest.advanceTimersByTimeAsync(5000);

      expect(fetchMock).not.toHaveBeenCalled(); // No heartbeats or polls
    });
  });

  describe('Test I & J: Generic command payload and correlation ID preserved', () => {
    it('should handle opaque payloads seamlessly', async () => {
      const fetchMock = global.fetch as jest.Mock;
      
      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ success: true, data: { accessToken: 'valid-token' } }),
      }));

      const command: ConnectorCommandDto = {
        id: 'cmd-correlation',
        connectorId: 'conn-123',
        commandType: 'UNKNOWN_CUSTOM_TYPE',
        payloadJson: '{"custom":"data","corr":"abcd"}',
        status: 'PENDING',
        retries: 0,
        createdAt: new Date().toISOString(),
      };

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ command }),
      }));

      fetchMock.mockImplementationOnce(async () => ({
        ok: true,
        json: async () => ({ success: true }),
      }));

      fetchMock.mockImplementation(async () => ({
        ok: true,
        json: async () => ({ command: null }),
      }));

      await client.authenticate();

      const handler = jest.fn().mockResolvedValue({
        responseCode: 'PROCESSED',
        payloadJson: '{"corr":"abcd"}',
      });

      client.startPolling(handler, 1000);
      await jest.advanceTimersByTimeAsync(10);
      
      expect(handler).toHaveBeenCalledWith(command);
      
      const respondCall = fetchMock.mock.calls.find(call => call[0].includes('response'));
      expect(respondCall).toBeDefined();
      expect(JSON.parse(respondCall[1].body)).toEqual({
        responseCode: 'PROCESSED',
        payloadJson: '{"corr":"abcd"}',
      });
    });
  });
});
