import { config } from 'dotenv';
import { Agent } from './agent';

config();

const CONNECTOR_ID = process.env.CONNECTOR_ID;
const CONNECTOR_SECRET = process.env.CONNECTOR_SECRET;
const ORG_ID = process.env.ORG_ID;
const WORKSPACE_ID = process.env.WORKSPACE_ID;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

if (!CONNECTOR_ID || !CONNECTOR_SECRET || !ORG_ID || !WORKSPACE_ID) {
  console.error('[MockAgent] Missing required environment variables:');
  console.error('CONNECTOR_ID, CONNECTOR_SECRET, ORG_ID, WORKSPACE_ID');
  process.exit(1);
}

const agent = new Agent(CONNECTOR_ID, CONNECTOR_SECRET, ORG_ID, WORKSPACE_ID, BASE_URL);

agent.start();

process.on('SIGINT', () => {
  agent.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  agent.stop();
  process.exit(0);
});
