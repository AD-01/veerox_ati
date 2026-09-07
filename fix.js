const fs = require('fs');
const path = require('path');

function rep(file, search, replace) {
  const full = path.join(__dirname, 'services/identity-service', file);
  if (!fs.existsSync(full)) return;
  let cnt = fs.readFileSync(full, 'utf8');
  cnt = cnt.replace(search, replace);
  fs.writeFileSync(full, cnt);
}

// auth.controller.ts
rep('src/api/controllers/auth.controller.ts', /import \{ RegisterUserCommand \} from '\.\.\/\.\.\/application\/commands\/register-user\.command';\n/, '');
rep('src/api/controllers/auth.controller.ts', /@Req\(\) req: any/g, "@Req() req: import('express').Request & { user?: Record<string, unknown> }");

// user.controller.ts
rep('src/api/controllers/user.controller.ts', /@Body\(\) dto: any/, '@Body() _dto: unknown');
rep('src/api/controllers/user.controller.ts', /@Param\('id'\) id: string/, "@Param('id') _id: string");
rep('src/api/controllers/user.controller.ts', /data: \{ id \}/, 'data: { id: _id }');

// app.module.ts
rep('src/app.module.ts', /expiresIn: expiresIn as any/g, 'expiresIn: expiresIn as unknown as number');

// login.handler.spec.ts
rep('src/application/handlers/login.handler.spec.ts', /let jwtService: any;/, 'let jwtService: unknown;');
rep('src/application/handlers/login.handler.spec.ts', /let tokenService: any;/, 'let tokenService: unknown;');
rep('src/application/handlers/login.handler.spec.ts', /as any/g, 'as unknown');

// logout.handler.spec.ts
rep('src/application/handlers/logout.handler.spec.ts', /let tokenService: any;/, 'let tokenService: unknown;');

// refresh-token.handler.spec.ts
rep('src/application/handlers/refresh-token.handler.spec.ts', /let tokenService: any;/, 'let tokenService: unknown;');
rep('src/application/handlers/refresh-token.handler.spec.ts', /let jwtService: any;/, 'let jwtService: unknown;');
rep('src/application/handlers/refresh-token.handler.spec.ts', /let userRepository: any;/, 'let userRepository: unknown;');
rep('src/application/handlers/refresh-token.handler.spec.ts', /let prismaService: any;/, 'let prismaService: unknown;');
rep('src/application/handlers/refresh-token.handler.spec.ts', /as any/g, 'as unknown');

// user.aggregate.ts
rep('src/domain/aggregates/user.aggregate.ts', /import \{ UserRoleChangedEvent \} from '\.\.\/events\/user-role-changed\.event';\n/, '');

// password-hash.value-object.ts
rep('src/domain/value-objects/password-hash.value-object.ts', /\(err\)/, '()');

// env.ts
rep('src/env.ts', /import \{ z \} from 'zod';\n/, '');

// jwt-auth.guard.spec.ts
rep('src/infrastructure/auth/jwt-auth.guard.spec.ts', /import \{ ExecutionContext \} from '@nestjs\/common';\n/, '');
rep('src/infrastructure/auth/jwt-auth.guard.spec.ts', /let reflector: any;\n/, '');
rep('src/infrastructure/auth/jwt-auth.guard.spec.ts', /let jwtService: any;/, 'let jwtService: unknown;');
rep('src/infrastructure/auth/jwt-auth.guard.spec.ts', /const context: any = /g, 'const context: unknown = ');
rep('src/infrastructure/auth/jwt-auth.guard.spec.ts', /\(e: any\)/, '(e: unknown)');
rep('src/infrastructure/auth/jwt-auth.guard.spec.ts', /reflector = [^;]+;\n/, '');

// jwt-auth.guard.ts
rep('src/infrastructure/auth/jwt-auth.guard.ts', /\(err: any, user: any, info: any, context: any\)/, '(err: unknown, user: unknown, _info: unknown, _context: unknown)');

// jwt.strategy.ts
rep('src/infrastructure/auth/jwt.strategy.ts', /payload: any/, 'payload: Record<string, unknown>');

// token.service.spec.ts
rep('src/infrastructure/auth/token.service.spec.ts', /let redisClient: any;/, 'let redisClient: unknown;');
rep('src/infrastructure/auth/token.service.spec.ts', /as any/g, 'as unknown');

// token.service.ts
rep('src/infrastructure/auth/token.service.ts', /import \{ Injectable, UnauthorizedException \} from '@nestjs\/common';/, "import { Injectable } from '@nestjs/common';");
rep('src/infrastructure/auth/token.service.ts', /expiresIn: accessTokenExpires as any/g, 'expiresIn: accessTokenExpires as unknown as number');
rep('src/infrastructure/auth/token.service.ts', /expiresIn: sessionAbsolute as any/g, 'expiresIn: sessionAbsolute as unknown as number');

// user.repository.ts
rep('src/infrastructure/repositories/user.repository.ts', /\(e: any\)/, '(e: unknown)');

console.log("Lint fixes applied.");
