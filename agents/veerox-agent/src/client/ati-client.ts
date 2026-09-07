import axios, { AxiosInstance } from 'axios';

export interface HeartbeatPayload {
  agentVersion: string;
  health: {
    cpuUsage: number;
    memoryUsage: number;
    networkLatency: number;
  };
}

export interface CommandPayload {
  id: string;
  commandType: string;
  payloadJson: string;
}

export class AtiClient {
  private identityClient: AxiosInstance;
  private workspaceClient: AxiosInstance;
  private token: string | null = null;
  private readonly baseUrl: string;

  constructor(private connectorId: string, private clientSecret: string, baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.identityClient = axios.create({ baseURL: baseUrl }); // Usually identity runs on same api gateway
    this.workspaceClient = axios.create({ baseURL: baseUrl });
    
    // Add auth interceptor for workspace requests
    this.workspaceClient.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  async authenticate(): Promise<void> {
    const response = await this.identityClient.post('/api/v1/auth/connector', {
      connectorId: this.connectorId,
      clientSecret: this.clientSecret,
    });
    
    // Identity service returns { success: true, data: { accessToken: "..." } }
    if (response.data && response.data.success && response.data.data.accessToken) {
      this.token = response.data.data.accessToken;
      console.log(`[AtiClient] Authenticated successfully.`);
    } else {
      throw new Error('Authentication failed: Invalid response format');
    }
  }

  async sendHeartbeat(orgId: string, workspaceId: string, payload: HeartbeatPayload): Promise<void> {
    await this.workspaceClient.post(`/api/v1/organizations/${orgId}/workspaces/${workspaceId}/connectors/${this.connectorId}/heartbeat`, payload);
  }

  async fetchPendingCommand(orgId: string, workspaceId: string): Promise<CommandPayload | null> {
    const response = await this.workspaceClient.get(`/api/v1/organizations/${orgId}/workspaces/${workspaceId}/connectors/${this.connectorId}/commands/pending`);
    return response.data?.command || null;
  }

  async submitCommandResponse(orgId: string, workspaceId: string, commandId: string, responseCode: string, payloadJson: string): Promise<void> {
    await this.workspaceClient.post(`/api/v1/organizations/${orgId}/workspaces/${workspaceId}/connectors/${this.connectorId}/commands/${commandId}/response`, {
      responseCode,
      payloadJson
    });
  }
}
