# VEEROX ATI

**Document ID:** 012  
**Document Name:** API Specification  
**Version:** 1.0.0  
**Status:** Baseline

---

# 1. Purpose

This document defines the complete API contract for the Veerox ATI Platform.

It specifies:

- REST APIs
- WebSocket APIs
- Authentication
- Authorization
- Request/Response Contracts
- Error Handling
- Versioning
- Pagination
- Filtering
- Idempotency
- API Lifecycle

This document is the implementation contract between frontend, backend services, AI services, MT5 Agent, and external integrations.

---

# 2. API Architecture Principles

The API layer SHALL follow these principles:

- Resource-oriented design
- Stateless communication
- Versioned APIs
- Consistent response structure
- Idempotent operations where applicable
- Secure by default
- Domain-oriented routing
- OpenAPI compatible

No business logic SHALL exist inside controllers.

Controllers SHALL only:

- Validate request
- Authorize request
- Invoke application service
- Return response

---

# 3. API Versioning

Base URL

```text
/api/v1
```

Future versions

```text
/api/v2
/api/v3
```

Breaking changes SHALL require a new major version.

---

# 4. Authentication

Protected APIs SHALL require authentication.

Supported mechanisms:

- JWT Access Token
- Refresh Token
- API Key (System Integrations)
- Service Token (Internal Services)

Authorization header

```http
Authorization: Bearer <access_token>
```

---

# 5. Standard Response Format

Successful response

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "requestId": "req_123",
  "timestamp": "2026-08-07T10:00:00Z"
}
```

Error response

```json
{
  "success": false,
  "error": {
    "code": "RISK_LIMIT_EXCEEDED",
    "message": "Daily risk limit reached.",
    "details": {}
  },
  "requestId": "req_123",
  "timestamp": "2026-08-07T10:00:00Z"
}
```

---

# 6. HTTP Status Codes

| Status | Meaning |
|---------|----------|
|200|Success|
|201|Created|
|202|Accepted|
|204|No Content|
|400|Bad Request|
|401|Unauthorized|
|403|Forbidden|
|404|Not Found|
|409|Conflict|
|422|Validation Error|
|429|Rate Limited|
|500|Internal Error|
|503|Service Unavailable|

---

# 7. Pagination Standard

Request

```http
GET /api/v1/strategies?page=1&pageSize=20
```

Response

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalPages": 15,
    "totalItems": 289
  }
}
```

---

# 8. Filtering

Example

```http
GET /api/v1/strategies?status=ACTIVE&risk=LOW
```

Supported filters SHALL be documented per endpoint.

---

# 9. Sorting

Example

```http
GET /api/v1/strategies?sort=name&order=asc
```

---

# 10. Idempotency

Critical POST operations SHALL support:

```http
Idempotency-Key:
```

Examples

- Purchase
- Execute Trade
- License Activation
- Strategy Activation

Duplicate requests SHALL return the original result.

---

# 11. Identity API

---

## Login

POST

```http
/api/v1/auth/login
```

Request

```json
{
  "email": "user@example.com",
  "password": "********"
}
```

Response

```json
{
  "accessToken": "",
  "refreshToken": "",
  "expiresIn": 3600
}
```

---

## Refresh Token

POST

```http
/api/v1/auth/refresh
```

---

## Logout

POST

```http
/api/v1/auth/logout
```

---

## Current User

GET

```http
/api/v1/auth/me
```

Status:
STRICTLY AUTHENTICATED (Active Session Required)

Returns the current authenticated user's profile information fetched directly from the database (not derived solely from JWT claims).

Request Headers:
\`\`\`http
Authorization: Bearer <access_token>
\`\`\`

Response (200 OK):
\`\`\`json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "roles": ["Trader"]
  }
}
\`\`\`

Error Responses:
- \`401 Unauthorized\`: Missing, invalid, expired, or revoked token.
- \`404 Not Found\`: Authenticated user no longer exists.

**Security Constraints:**
- NEVER expose \`passwordHash\`, refresh tokens, access tokens, or internal credential material.

---

# 12. User API

---

## Create User

POST

```http
/api/v1/users
```

---

## Update User

PUT

```http
/api/v1/users/{id}
```

---

## Delete User

DELETE

```http
/api/v1/users/{id}
```

---

## List Users

GET

```http
/api/v1/users
```

Supports:

- Pagination
- Search
- Filtering

---

# 13. Organization API

---

## Create Organization

POST

```http
/api/v1/organizations
```

---

## List Organizations

GET

```http
/api/v1/organizations
```

---

## Update Organization

PUT

```http
/api/v1/organizations/{id}
```

---

## Invite Member

POST

```http
/api/v1/organizations/{id}/members
```

---

# 14. Workspace API

---

## Create Workspace

POST

```http
/api/v1/workspaces
```

---

## List Workspaces

GET

```http
/api/v1/workspaces
```

---

## Archive Workspace

POST

```http
/api/v1/workspaces/{id}/archive
```

---

## Workspace Settings

PUT

```http
/api/v1/workspaces/{id}/settings
```

---

# 15. Strategy API

---

## Register Strategy

POST

```http
/api/v1/strategies
```

---

## Activate Strategy

POST

```http
/api/v1/strategies/{id}/activate
```

---

## Suspend Strategy

POST

```http
/api/v1/strategies/{id}/suspend
```

---

## Retire Strategy

POST

```http
/api/v1/strategies/{id}/retire
```

---

## Strategy Ranking

GET

```http
/api/v1/strategies/ranking
```

Returns:

- Ranked strategies
- Confidence
- Expected Risk
- Recommended EA

---

# 16. Expert Advisor API

---

## Register EA

POST

```http
/api/v1/expert-advisors
```

---

## Activate EA

POST

```http
/api/v1/expert-advisors/{id}/activate
```

---

## Manual EA Assignment

POST

```http
/api/v1/expert-advisors/{id}/assign
```

---

## Upload EA Package

POST

```http
/api/v1/expert-advisors/upload
```

Supports:

- EX5
- Source Package (licensed)

---

# End of Part 1

**Next Chapter:**

- Market Intelligence APIs
- Risk APIs
- Portfolio APIs
- Decision APIs
- Execution APIs
- Marketplace APIs
- AI APIs
- Notification APIs
- WebSocket APIs
- Internal Service APIs

This API specification will ultimately contain **300+ endpoint contracts** covering the entire Veerox ATI platform.