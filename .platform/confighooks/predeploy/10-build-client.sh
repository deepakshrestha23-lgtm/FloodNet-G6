#!/bin/bash
set -euo pipefail

# A configuration-only deployment also rebuilds Vite, so explicitly expose
# the public client configuration stored as Elastic Beanstalk properties.
if [ -x /opt/elasticbeanstalk/bin/get-config ]; then
  for variable in VITE_EVIDENCE_ENABLED VITE_TASK2_EVIDENCE_ENABLED VITE_EVIDENCE_API_URL VITE_MAPTILER_API_KEY; do
    value="$(/opt/elasticbeanstalk/bin/get-config environment -k "$variable" 2>/dev/null || true)"
    if [ -n "$value" ]; then
      export "$variable=$value"
    fi
  done
fi

# Configuration updates can restart the application without running the
# ordinary platform predeploy hook. Rebuild the React bundle here as well so
# Express always has client/dist before it starts serving the application.
npm install --include=dev
npm run build --workspace client
