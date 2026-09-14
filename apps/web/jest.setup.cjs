require('@testing-library/jest-dom');
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
if (typeof Request === 'undefined') {
  const nodeFetch = require('node-fetch');
  global.Request = nodeFetch.Request;
  global.Response = nodeFetch.Response;
  global.Response.json = (data, init) => {
    return new nodeFetch.Response(JSON.stringify(data), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers || {}) }
    });
  };
  global.Headers = nodeFetch.Headers;
  global.fetch = nodeFetch;
}
process.env.IDENTITY_SERVICE_URL = 'http://prod-auth';
process.env.ORGANIZATION_SERVICE_URL = 'http://prod-org';
process.env.WORKSPACE_SERVICE_URL = 'http://prod-workspace';
process.env.STRATEGY_SERVICE_URL = 'http://prod-strategy';
process.env.RISK_SERVICE_URL = 'http://prod-risk';
process.env.PORTFOLIO_SERVICE_URL = 'http://prod-portfolio';
process.env.EXECUTION_SERVICE_URL = 'http://prod-execution';
process.env.MARKET_SERVICE_URL = 'http://prod-market';
process.env.AI_SERVICE_URL = 'http://prod-ai';
process.env.DECISION_SERVICE_URL = 'http://prod-decision';
process.env.BILLING_SERVICE_URL = 'http://prod-billing';
process.env.LICENSING_SERVICE_URL = 'http://prod-licensing';
process.env.MARKETPLACE_SERVICE_URL = 'http://prod-marketplace';
