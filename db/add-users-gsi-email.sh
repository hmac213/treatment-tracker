#!/usr/bin/env bash
# Add the gsi_email GSI to the users table (required for login / GetUserByEmail).
# Run if the table was created without this index.
# Requires: AWS CLI configured. Set AWS_REGION if needed (e.g. us-west-2).

set -euo pipefail

TABLE_NAME="${TABLE_PREFIX:-treatment_tracker}_users"
REGION="${AWS_REGION:-us-west-2}"

echo "Adding GSI gsi_email to table: $TABLE_NAME (region: $REGION)"

aws dynamodb update-table \
  --region "$REGION" \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
    AttributeName=gsi_pk,AttributeType=S \
    AttributeName=gsi_sk,AttributeType=S \
  --global-secondary-index-updates '[
    {
      "Create": {
        "IndexName": "gsi_email",
        "KeySchema": [
          {"AttributeName": "gsi_pk", "KeyType": "HASH"},
          {"AttributeName": "gsi_sk", "KeyType": "RANGE"}
        ],
        "Projection": {"ProjectionType": "ALL"}
      }
    }
  ]'

echo "GSI creation started. Index is BACKFILLING (a few minutes). Check status with:"
echo "  aws dynamodb describe-table --region $REGION --table-name $TABLE_NAME --query 'Table.GlobalSecondaryIndexes[?IndexName==\`gsi_email\`].IndexStatus'"
