#!/bin/bash
set -euo pipefail

# Configuration updates can restart the application without running the
# ordinary platform predeploy hook. Rebuild the React bundle here as well so
# Express always has client/dist before it starts serving the application.
npm install --include=dev
npm run build --workspace client
