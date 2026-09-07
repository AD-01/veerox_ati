import {
  ConnectorClientConfig,
  ConnectorHeartbeatDto,
  CommandResponseDto,
  ConnectorCommandDto,
  CommandHandler,
} from './types';

export class ConnectorClient {
  private config: ConnectorClientConfig;
  private token: string | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(config: ConnectorClientConfig) {
    this.config = config;
  }

  /**
   * Authenticates the connector to receive a machine JWT.
   */
  async authenticate(): Promise<void> {
    if (this.isShuttingDown) return;

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/auth/connector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId: this.config.connectorId,
          clientSecret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.statusText}`);
      }

      const body = await response.json();
      if (!body.success || !body.data || !body.data.accessToken) {
        throw new Error('Invalid authentication response structure');
      }

      this.token = body.data.accessToken;
    } catch (err) {
      this.token = null;
      throw err;
    }
  }

  private get authHeaders(): HeadersInit {
    if (!this.token) {
      throw new Error('Not authenticated');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };
  }

  private get workspaceUrl(): string {
    return `${this.config.baseUrl}/organizations/${this.config.organizationId}/workspaces/${this.config.workspaceId}/connectors/${this.config.connectorId}`;
  }

  /**
   * Sends a heartbeat to the platform.
   */
  async heartbeat(dto: ConnectorHeartbeatDto = {}): Promise<void> {
    if (!this.token || this.isShuttingDown) return;

    const response = await fetch(`${this.workspaceUrl}/heartbeat`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.token = null;
        throw new Error('Authentication revoked during heartbeat');
      }
      throw new Error(`Heartbeat failed: ${response.statusText}`);
    }
  }

  /**
   * Fetches the next pending command.
   */
  async claimCommand(): Promise<ConnectorCommandDto | null> {
    if (!this.token || this.isShuttingDown) return null;

    const response = await fetch(`${this.workspaceUrl}/commands/pending`, {
      method: 'GET',
      headers: this.authHeaders,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.token = null;
        throw new Error('Authentication revoked during polling');
      }
      throw new Error(`Failed to claim command: ${response.statusText}`);
    }

    const body = await response.json();
    return body.command || null;
  }

  /**
   * Submits a response for a processed command.
   */
  async respondToCommand(
    commandId: string,
    dto: CommandResponseDto,
  ): Promise<void> {
    if (!this.token || this.isShuttingDown) return;

    const response = await fetch(`${this.workspaceUrl}/commands/${commandId}/response`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(dto),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.token = null;
        throw new Error('Authentication revoked during response submission');
      }
      throw new Error(`Failed to submit response: ${response.statusText}`);
    }
  }

  /**
   * Establishes full connectivity (Auth -> Heartbeat).
   */
  async connect(agentVersion = '1.0.0'): Promise<void> {
    this.isShuttingDown = false;
    await this.authenticate();
    await this.heartbeat({ agentVersion });
  }

  /**
   * Gracefully shuts down the client, stopping loops.
   */
  disconnect(): void {
    this.isShuttingDown = true;
    this.token = null;
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Starts an automated heartbeat loop.
   */
  startHeartbeat(intervalMs = 30000, getHealth?: () => ConnectorHeartbeatDto): void {
    if (this.heartbeatInterval) return;

    this.heartbeatInterval = setInterval(async () => {
      if (this.isShuttingDown || !this.token) return;
      try {
        const dto = getHealth ? getHealth() : {};
        await this.heartbeat(dto);
      } catch {
        // In a real agent, we would log this securely
        // If auth revoked, the next operation will fail cleanly or we stop
        if (!this.token) {
          this.disconnect();
        }
      }
    }, intervalMs);
  }

  /**
   * Starts an automated command polling loop.
   */
  startPolling(handler: CommandHandler, intervalMs = 5000): void {
    if (this.pollingInterval) return;

    // Use a recursive timeout to prevent overlapping requests if processing is slow
    const loop = async () => {
      if (this.isShuttingDown || !this.token) return;

      try {
        const command = await this.claimCommand();
        if (command) {
          const response = await handler(command);
          await this.respondToCommand(command.id, response);
        }
      } catch {
        if (!this.token) {
          this.disconnect();
          return;
        }
        // Eat other errors and retry next loop
      }

      if (!this.isShuttingDown && this.token) {
        this.pollingInterval = setTimeout(loop, intervalMs);
      }
    };

    // Start immediately, then loop
    loop();
  }
}
