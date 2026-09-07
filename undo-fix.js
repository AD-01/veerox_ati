const fs = require('fs');
const path = require('path');

function rep(file, search, replace) {
  const full = path.join(__dirname, 'services/identity-service', file);
  if (!fs.existsSync(full)) return;
  let cnt = fs.readFileSync(full, 'utf8');
  cnt = cnt.replace(search, replace);
  fs.writeFileSync(full, cnt);
}

// Just globally change : unknown to : any in all test specs
const files = [
  'src/application/handlers/login.handler.spec.ts',
  'src/application/handlers/logout.handler.spec.ts',
  'src/application/handlers/refresh-token.handler.spec.ts',
  'src/infrastructure/auth/jwt-auth.guard.spec.ts',
  'src/infrastructure/auth/token.service.spec.ts',
  'src/api/controllers/auth.controller.ts',
  'src/api/controllers/user.controller.ts',
  'src/app.module.ts',
  'src/infrastructure/auth/jwt-auth.guard.ts',
  'src/infrastructure/auth/jwt.strategy.ts',
  'src/infrastructure/auth/token.service.ts',
  'src/infrastructure/repositories/user.repository.ts'
];

files.forEach(f => {
  rep(f, /: unknown/g, ': any');
  rep(f, /as unknown/g, 'as any');
  rep(f, /: import\('express'\)\.Request & \{ user\?: Record<string, any> \}/g, ': any');
  rep(f, /: import\('express'\)\.Request/g, ': any');
});

console.log("Reverted unknown to any.");
