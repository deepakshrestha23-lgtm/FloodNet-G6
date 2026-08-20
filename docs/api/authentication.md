# Authentication and authorization

## Authentication model

- Passwords are hashed with bcrypt using 12 cost rounds.
- Login returns a short-lived access token in the JSON response.
- Refresh tokens are stored only in an HTTP-only cookie.
- Refresh-token hashes are stored in PostgreSQL, never raw refresh tokens.
- Refresh tokens rotate on every refresh and include a unique token ID.
- Logout revokes the current refresh session.
- Disabled users are rejected even if an old access token has not expired.

## Endpoints

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Creates a Resident account only |
| POST | `/api/auth/login` | Public | Returns an access token and refresh cookie |
| POST | `/api/auth/refresh` | Refresh cookie | Rotates the refresh token and returns a new access token |
| POST | `/api/auth/logout` | Refresh cookie | Revokes the current refresh session |
| GET | `/api/auth/me` | Access token | Returns the current account and role |
| PATCH | `/api/auth/me` | Access token | Updates the current profile |

Registration never accepts a role from the client. Staff roles will be assigned through the Administrator module.

## Protected request format

```text
Authorization: Bearer <access-token>
```

Every protected backend route must use `authenticate`. Business routes must additionally use `requireRoles` with the exact allowed role codes.
