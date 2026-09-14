import NodeEnvironment from 'jest-environment-node';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import path from 'path';

class PrismaTestEnvironment extends NodeEnvironment {
  private schema: string;
  private connectionString: string;
  private baseConnectionString: string;

  constructor(config: any, context: any) {
    super(config, context);
    
    // Generate an isolated schema name per test worker/suite
    this.schema = `test_${randomUUID().replace(/-/g, '')}`;
    
    // Fallback to local deterministic test DB if TEST_DATABASE_URL is absent
    this.baseConnectionString = process.env.TEST_DATABASE_URL || 'postgresql://testuser:testpassword@localhost:5432/veerox_test';
    
    // SAFEGUARD: Never run against the live Neon production database
    if (this.baseConnectionString.includes('aws.neon.tech') && !process.env.TEST_DATABASE_URL) {
      throw new Error('TEST_DATABASE_URL MUST be explicitly provided, or fall back to localhost. Refusing to run tests against production Neon.');
    }

    const url = new URL(this.baseConnectionString);
    url.searchParams.set('schema', this.schema);
    
    this.connectionString = url.toString();
  }

  async setup() {
    await super.setup();
    
    // Inject the dynamically isolated URL into the test environment
    this.global.process.env.DATABASE_URL = this.connectionString;

    const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
    
    try {
      // Provision the schema
      execSync(`npx prisma db push --schema="${schemaPath}" --skip-generate --accept-data-loss`, {
        env: { ...process.env, DATABASE_URL: this.connectionString },
        stdio: 'ignore'
      });
    } catch (err: any) {
      console.error(`Failed to push schema ${this.schema} (Make sure local Docker is running):`, err.message);
      throw err;
    }
  }

  async teardown() {
    try {
      // Connect to the base DB to execute schema cleanup
      const client = new PrismaClient({ datasources: { db: { url: this.baseConnectionString } } });
      await client.$connect();
      
      // Prevent dropping public schema
      if (this.schema !== 'public' && this.schema !== '') {
        await client.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${this.schema}" CASCADE`);
      }
      
      await client.$disconnect();
    } catch (e) {
      console.error('Failed to teardown test schema:', e);
    }
    await super.teardown();
  }
}

export default PrismaTestEnvironment;
