# Resident flood reports

## Report lifecycle

```text
PENDING_REVIEW
      |
      +--> VERIFIED --> CLOSED
      |
      +--> REJECTED
      |
      +--> MORE_INFORMATION_REQUIRED
                    |
                    +--> resident update --> PENDING_REVIEW
```

Residents cannot verify, reject or close their own reports.

## Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/reports` | Submit a new Resident report |
| GET | `/api/reports/mine` | List the authenticated Resident's reports |
| GET | `/api/reports/:id` | View one owned report |
| GET | `/api/reports/:id/history` | View owned report status history and officer feedback |
| PATCH | `/api/reports/:id` | Submit additional information when status is `MORE_INFORMATION_REQUIRED` |
| POST | `/api/reports/:id/evidence` | Task 1: upload optional JPEG, PNG or WebP evidence images through Express |
| GET | `/api/reports/:id/evidence` | View evidence metadata for an owned report |
| GET | `/api/reports/:id/evidence/:evidenceId/url` | Generate a short-lived authorized URL for an owned evidence image |
| POST | `/api/reports/:id/evidence/session` | Create a short-lived report-specific upload session |
| POST | `/api/reports/:id/evidence/complete` | Confirm a successful private S3 upload and save metadata |

All report endpoints require a valid access token. Ownership is enforced in SQL using both the report ID and authenticated resident ID.

## Location fields

New reports use `wardId` from the public cascading geography API as their
canonical administrative location. They may also include:

```json
{
  "wardId": "uuid",
  "locality": "Tole or neighbourhood",
  "nearestLandmark": "Bridge or school",
  "latitude": 27.7172,
  "longitude": 85.324,
  "floodType": "URBAN_DRAINAGE",
  "peopleAtRisk": 12
}
```

`zoneId` is optional operational context. It is not a replacement for the
official ward and is never treated as an administrative boundary. A report's
ward, locality, landmark and coordinates are fixed after initial submission;
the additional-information flow can update the descriptive observation fields.

## Public endpoints

| Method | Endpoint | Public data |
|---|---|---|
| GET | `/api/public/zones` | Active flood zones for report forms and filters |
| GET | `/api/public/alerts` | Currently published, valid alerts |
| GET | `/api/public/incidents` | Only `VERIFIED` and `CLOSED` incident summaries |
| GET | `/api/public/centres` | Active evacuation-centre capacity and facilities |

Public responses never include resident identity, private officer notes, evidence metadata or audit records.

Task 1 uses `POST /api/reports/:id/evidence`, so the browser sends images to Express and Express uploads them to private S3. The Task 2 Evidence Lambda remains exposed separately through API Gateway as `POST /evidence/upload-url`; in that mode the browser uses the returned URL for the direct S3 upload, then calls the compatible Express completion endpoint. Task 2 is not required for the working Task 1 photo feature.
