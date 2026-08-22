#!/bin/bash
set -euo pipefail

# The Express server serves client/dist in production.  Elastic Beanstalk
# installs runtime dependencies for the Node application, so explicitly keep
# workspace development dependencies available for the Vite build.
npm install --include=dev
npm run build --workspace client
