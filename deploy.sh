#!/bin/bash
set -euo pipefail

# ---- Configuration ----
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-asia-northeast1}"
SERVICE_NAME="subscrip-notify"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo "=== Building and deploying ${SERVICE_NAME} ==="

# 1) Build & push container
echo "[1/4] Building container..."
cd backend
gcloud builds submit --tag "${IMAGE}" --project "${PROJECT_ID}"
cd ..

# 2) Deploy to Cloud Run
echo "[2/4] Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production" \
  --set-secrets "GOOGLE_CLIENT_ID=google-client-id:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest,LINE_CHANNEL_ACCESS_TOKEN=line-channel-access-token:latest,LINE_CHANNEL_SECRET=line-channel-secret:latest,TOKEN_ENCRYPTION_KEY=token-encryption-key:latest,SCHEDULER_SECRET=scheduler-secret:latest" \
  --project "${PROJECT_ID}"

# Get service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --region "${REGION}" \
  --project "${PROJECT_ID}" \
  --format "value(status.url)")
echo "Service URL: ${SERVICE_URL}"

# 3) Create Cloud Scheduler jobs
echo "[3/4] Creating Cloud Scheduler jobs..."

# Free tier: every 15 minutes
gcloud scheduler jobs create http "${SERVICE_NAME}-poll-free" \
  --location "${REGION}" \
  --schedule "*/15 * * * *" \
  --uri "${SERVICE_URL}/jobs/poll" \
  --http-method POST \
  --headers "x-scheduler-secret=\${SCHEDULER_SECRET}" \
  --time-zone "Asia/Tokyo" \
  --project "${PROJECT_ID}" \
  --quiet 2>/dev/null || \
gcloud scheduler jobs update http "${SERVICE_NAME}-poll-free" \
  --location "${REGION}" \
  --schedule "*/15 * * * *" \
  --uri "${SERVICE_URL}/jobs/poll" \
  --http-method POST \
  --headers "x-scheduler-secret=\${SCHEDULER_SECRET}" \
  --time-zone "Asia/Tokyo" \
  --project "${PROJECT_ID}"

echo "[4/4] Done!"
echo ""
echo "Next steps:"
echo "  1. Set secrets in Secret Manager"
echo "  2. Configure LINE webhook URL: ${SERVICE_URL}/line/webhook"
echo "  3. Configure Google OAuth redirect URI in GCP Console"
