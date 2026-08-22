# FloodNet architecture

## Task 1

```text
React/Vite -> Express Evidence functionality -> private S3
                         |                 \-> Amazon RDS for PostgreSQL
                         \-> Elastic Beanstalk deployment
```

The frontend and REST backend remain separated in the repository but are deployed together in one Elastic Beanstalk Node.js environment. Express serves the Vite production build and `/api` routes. Task 1 residents can optionally attach evidence photographs; Express stores image bytes in private S3 and evidence metadata in RDS.

## Location architecture

FloodNet keeps official administrative geography separate from operational flood
zones. Reports and centres use a normalized Province → District → Local Level →
Ward hierarchy, with optional locality, landmark and GPS detail. Operational
zones remain a separate many-to-many overlay for broad risk areas. This prevents
a fictional or temporary response zone from being mistaken for a government
administrative boundary.

Operational officers receive a server-side jurisdiction assignment. Express
applies that scope to report, alert, centre, evidence and dashboard queries;
React selectors only choose filters and never grant access.

Leaflet is a presentation layer over this model. MapTiler supplies the
OpenStreetMap-based tiles, while FloodNet supplies the authorized markers from
its existing APIs. Reports are never added to a public map, alerts remain
administrative-area targets rather than misleading point markers, and the
selected ward remains canonical when a resident chooses a more precise point.

## Task 2

```text
React/Vite -> API Gateway -> Evidence Lambda -> private S3
FloodNet main application -> Elastic Beanstalk -> Express -> RDS
                       |\
                       | API Gateway -> Notification Lambda -> SNS
                       |
                       +-> CloudWatch logs and metrics
```

Task 2 evolves the Task 1 system. It does not replace the main application or move all business logic into Lambda.

## Architectural boundaries

- Express remains responsible for core FloodNet workflows and RDS transactions.
- Task 1 Express Evidence functionality manages authorization, uploads and authorized access to private S3.
- Task 2 Evidence Lambda takes over the upload/storage responsibility through API Gateway while preserving the existing report/evidence metadata contract in RDS.
- Notification Lambda delivers trusted published-alert notifications through SNS.
- Public endpoints never expose resident identity, private notes, credentials or sensitive audit data.
