import { config } from 'dotenv';
import { AgentRuntime } from './core/agent-runtime';
import { WebSocketClientTransport } from './transport/websocket-transport';
import { TcpBridge } from './mt5-bridge/tcp-bridge';

config();

const CONNECTOR_ID = process.env.CONNECTOR_ID || 'connector-local';
const CONNECTOR_SECRET = process.env.CONNECTOR_SECRET || 'secret';
const ORG_ID = process.env.ORG_ID || 'org-local';
const WORKSPACE_ID = process.env.WORKSPACE_ID || 'workspace-local';
const ACCOUNT_ID = process.env.ACCOUNT_ID || 'account-local';
const AGENT_ID = process.env.AGENT_ID || 'agent-local';
const WS_URL = process.env.WS_URL || 'wss://localhost:4000/agent';

async function bootstrap() {
  console.log(`[Agent] Booting S-22 Phase 03 Agent Runtime...`);
  
  const transport = new WebSocketClientTransport(WS_URL, WS_URL.startsWith('wss://'));
  const tcpBridge = new TcpBridge(1337);
  
  tcpBridge.start();

  const runtime = new AgentRuntime(
    transport,
    tcpBridge,
    AGENT_ID,
    CONNECTOR_SECRET,
    ORG_ID,
    WORKSPACE_ID,
    CONNECTOR_ID,
    ACCOUNT_ID
  );

  await runtime.start();

  console.log(`[Agent] Started and connecting to transport...`);

  process.on('SIGINT', () => {
    console.log(`[Agent] Stopping...`);
    runtime.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log(`[Agent] Stopping...`);
    runtime.stop();
    process.exit(0);
  });
}

bootstrap().catch(err => {
  console.error(`[Agent] Fatal bootstrap error:`, err);
  process.exit(1);
});
