#!/bin/bash
set -euo pipefail

# Vite reads VITE_* values while building the browser bundle. Elastic
# Beanstalk environment properties are retrieved explicitly inside platform
# hooks; none of these values is a server credential.
if [ -x /opt/elasticbeanstalk/bin/get-config ]; then
  for variable in VITE_EVIDENCE_ENABLED VITE_TASK2_EVIDENCE_ENABLED VITE_EVIDENCE_API_URL VITE_MAPTILER_API_KEY; do
    value="$(/opt/elasticbeanstalk/bin/get-config environment -k "$variable" 2>/dev/null || true)"
    if [ -n "$value" ]; then
      export "$variable=$value"
    fi
  done
fi

# The Express server serves client/dist in production.  Elastic Beanstalk
# installs runtime dependencies for the Node application, so explicitly keep
# workspace development dependencies available for the Vite build.
npm install --include=dev
npm run build --workspace client
