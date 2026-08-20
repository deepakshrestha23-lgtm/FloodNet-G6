# FloodNet API contract

The REST API is served by Express under `/api`. Protected endpoints require authentication and role authorization on the server.

## Response envelope

Successful response:

```json
{
  "success": true,
  "data": {},
  "message": ""
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A readable error message"
  }
}
```

## Initial endpoint groups

| Group | Prefix | Main owner |
|---|---|---|
| Health | `/api/health` | Shared infrastructure |
| Authentication | `/api/auth` | Shared infrastructure |
| Public information | `/api/public` | Shared infrastructure |
| Resident reports | `/api/reports` | Resident module |
| Officer reviews and alerts | `/api/officer` | Flood Monitoring Officer |
| Evacuation centres | `/api/centres` | Evacuation Officer |
| Administration | `/api/admin` | System Administrator |

The detailed method and permission list is maintained in the Phase 0 blueprint and will be expanded with request/response examples as each module is implemented.

Authentication details are documented in [authentication.md](authentication.md).

Resident report details are documented in [resident-reports.md](resident-reports.md).
