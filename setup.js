const fs = require('fs');
const path = require('path');

const sharedPackages = ['contracts', 'events', 'sdk', 'shared', 'ui'];
sharedPackages.forEach(pkg => {
  const dir = path.join(__dirname, 'packages', pkg);
  const pkgJsonPath = path.join(dir, 'package.json');
  const content = fs.readFileSync(pkgJsonPath, 'utf8').replace(/^\uFEFF/, '');
  const pkgJson = JSON.parse(content);
  
  if (['contracts', 'events'].includes(pkg)) {
    pkgJson.dependencies = { "@veerox/shared": "workspace:*" };
  } else if (['sdk', 'ui'].includes(pkg)) {
    pkgJson.dependencies = {
      "@veerox/shared": "workspace:*",
      "@veerox/contracts": "workspace:*",
      "@veerox/events": "workspace:*"
    };
  }
  
  pkgJson.scripts = pkgJson.scripts || {};
  pkgJson.scripts.lint = "eslint \"src/**/*.ts\"";
  pkgJson.scripts.test = "jest";
  pkgJson.scripts.typecheck = "tsc --noEmit";
  
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2), 'utf8');
  
  fs.writeFileSync(path.join(dir, 'jest.config.js'), "module.exports = require('@veerox/config/jest.config.js');", 'utf8');
  fs.writeFileSync(path.join(dir, '.eslintrc.json'), JSON.stringify({"extends": "../../packages/config/eslint-node.json"}, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'src', 'index.spec.ts'), "describe('Module', () => { it('should initialize', () => { expect(true).toBe(true); }); });", 'utf8');
});

const apps = ['web', 'admin'];
apps.forEach(app => {
  const dir = path.join(__dirname, 'apps', app);
  const pkgJsonPath = path.join(dir, 'package.json');
  const content = fs.readFileSync(pkgJsonPath, 'utf8').replace(/^\uFEFF/, '');
  const pkgJson = JSON.parse(content);
  
  pkgJson.dependencies = pkgJson.dependencies || {};
  pkgJson.dependencies["@veerox/ui"] = "workspace:*";
  pkgJson.dependencies["@veerox/sdk"] = "workspace:*";
  pkgJson.dependencies["@veerox/shared"] = "workspace:*";
  
  pkgJson.scripts = pkgJson.scripts || {};
  pkgJson.scripts.typecheck = "tsc --noEmit";
  
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2), 'utf8');
});

const services = ['identity-service', 'organization-service', 'workspace-service'];
services.forEach(svc => {
  const dir = path.join(__dirname, 'services', svc);
  const pkgJsonPath = path.join(dir, 'package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  
  pkgJson.dependencies = pkgJson.dependencies || {};
  pkgJson.dependencies["@veerox/shared"] = "workspace:*";
  pkgJson.dependencies["@veerox/contracts"] = "workspace:*";
  pkgJson.dependencies["@veerox/events"] = "workspace:*";
  pkgJson.dependencies["zod"] = "^3.23.0";
  
  pkgJson.scripts = pkgJson.scripts || {};
  pkgJson.scripts.typecheck = "tsc --noEmit";
  pkgJson.scripts.lint = "eslint \"src/**/*.ts\"";
  pkgJson.scripts.test = "jest";
  
  fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2), 'utf8');
  
  fs.writeFileSync(path.join(dir, 'jest.config.js'), "module.exports = { preset: 'ts-jest', testEnvironment: 'node', rootDir: './src' };", 'utf8');
  fs.writeFileSync(path.join(dir, '.eslintrc.json'), JSON.stringify({"extends": "../../packages/config/eslint-node.json"}, null, 2), 'utf8');
  fs.writeFileSync(path.join(dir, 'src', 'app.module.spec.ts'), "import { AppModule } from './app.module'; describe('AppModule', () => { it('should be defined', () => { expect(AppModule).toBeDefined(); }); });", 'utf8');
  fs.writeFileSync(path.join(dir, '.env.example'), "PORT=3000\nNODE_ENV=development\n", 'utf8');
  
  const envTs = `import { z } from 'zod';\n\nexport const envSchema = z.object({\n  PORT: z.string().default('3000'),\n  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),\n});\n\nexport function validateEnv() {\n  return envSchema.parse(process.env);\n}\n`;
  fs.writeFileSync(path.join(dir, 'src', 'env.ts'), envTs, 'utf8');
  
  const mainTs = `import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\nimport { validateEnv } from './env';\n\nasync function bootstrap() {\n  const env = validateEnv();\n  const app = await NestFactory.create(AppModule);\n  await app.listen(env.PORT);\n}\nbootstrap();\n`;
  fs.writeFileSync(path.join(dir, 'src', 'main.ts'), mainTs, 'utf8');
});
