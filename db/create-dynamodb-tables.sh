#!/usr/bin/env bash
# Create all DynamoDB tables for treatment-tracker.
# Requires: AWS CLI configured (aws configure) with permissions for dynamodb:CreateTable.
# Optional: set AWS_REGION or use --region in the CLI. Tables are created in the default region.

set -euo pipefail

AWS_CMD="${AWS_CMD:-aws}"
REGION="${AWS_REGION:-}"

run_aws() {
  if [[ -n "$REGION" ]]; then
    "$AWS_CMD" dynamodb create-table --region "$REGION" "$@"
  else
    "$AWS_CMD" dynamodb create-table "$@"
  fi
}

# --- 1. treatment_tracker_users (pk only, GSI: gsi_email) ---
run_aws \
  --table-name treatment_tracker_users \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=gsi_pk,AttributeType=S \
    AttributeName=gsi_sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "gsi_email",
      "KeySchema": [
        {"AttributeName": "gsi_pk", "KeyType": "HASH"},
        {"AttributeName": "gsi_sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST

# --- 2. treatment_tracker_nodes (pk only, GSI: gsi_key) ---
run_aws \
  --table-name treatment_tracker_nodes \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=gsi_pk,AttributeType=S \
    AttributeName=gsi_sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "gsi_key",
      "KeySchema": [
        {"AttributeName": "gsi_pk", "KeyType": "HASH"},
        {"AttributeName": "gsi_sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST

# --- 3. treatment_tracker_node_categories (pk + sk, optional GSI: gsi_category) ---
run_aws \
  --table-name treatment_tracker_node_categories \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=gsi_pk,AttributeType=S \
    AttributeName=gsi_sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes '[
    {
      "IndexName": "gsi_category",
      "KeySchema": [
        {"AttributeName": "gsi_pk", "KeyType": "HASH"},
        {"AttributeName": "gsi_sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST

# --- 4. treatment_tracker_node_videos (pk + sk, no GSI) ---
run_aws \
  --table-name treatment_tracker_node_videos \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# --- 5. treatment_tracker_edges (pk only, GSIs: gsi_child, gsi_parent, gsi_unlock_type; each GSI has its own key attrs) ---
run_aws \
  --table-name treatment_tracker_edges \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=gsi_child_pk,AttributeType=S \
    AttributeName=gsi_child_sk,AttributeType=S \
    AttributeName=gsi_parent_pk,AttributeType=S \
    AttributeName=gsi_parent_sk,AttributeType=S \
    AttributeName=gsi_unlock_type_pk,AttributeType=S \
    AttributeName=gsi_unlock_type_sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "gsi_child",
      "KeySchema": [
        {"AttributeName": "gsi_child_pk", "KeyType": "HASH"},
        {"AttributeName": "gsi_child_sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "gsi_parent",
      "KeySchema": [
        {"AttributeName": "gsi_parent_pk", "KeyType": "HASH"},
        {"AttributeName": "gsi_parent_sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "gsi_unlock_type",
      "KeySchema": [
        {"AttributeName": "gsi_unlock_type_pk", "KeyType": "HASH"},
        {"AttributeName": "gsi_unlock_type_sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST

# --- 6. treatment_tracker_symptoms (pk only, GSI: gsi_key) ---
run_aws \
  --table-name treatment_tracker_symptoms \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=gsi_pk,AttributeType=S \
    AttributeName=gsi_sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "gsi_key",
      "KeySchema": [
        {"AttributeName": "gsi_pk", "KeyType": "HASH"},
        {"AttributeName": "gsi_sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST

# --- 7. treatment_tracker_user_unlocked_nodes (pk + sk, optional GSI: gsi_node) ---
run_aws \
  --table-name treatment_tracker_user_unlocked_nodes \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
    AttributeName=gsi_pk,AttributeType=S \
    AttributeName=gsi_sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --global-secondary-indexes '[
    {
      "IndexName": "gsi_node",
      "KeySchema": [
        {"AttributeName": "gsi_pk", "KeyType": "HASH"},
        {"AttributeName": "gsi_sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST

# --- 8. treatment_tracker_user_events (pk + sk, no GSI) ---
run_aws \
  --table-name treatment_tracker_user_events \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# --- 9. treatment_tracker_category_videos (pk + sk) ---
run_aws \
  --table-name treatment_tracker_category_videos \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# --- 10. treatment_tracker_category_positions (pk + sk) ---
run_aws \
  --table-name treatment_tracker_category_positions \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# --- 11. treatment_tracker_symptom_positions (pk + sk) ---
run_aws \
  --table-name treatment_tracker_symptom_positions \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# --- 12. treatment_tracker_bonus_content_videos (pk + sk) ---
run_aws \
  --table-name treatment_tracker_bonus_content_videos \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# --- 13. treatment_tracker_bonus_content_positions (pk + sk) ---
run_aws \
  --table-name treatment_tracker_bonus_content_positions \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# --- 14. treatment_tracker_introduction_tree_nodes (pk only, GSI: gsi_node_key) ---
run_aws \
  --table-name treatment_tracker_introduction_tree_nodes \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=gsi_pk,AttributeType=S \
    AttributeName=gsi_sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "gsi_node_key",
      "KeySchema": [
        {"AttributeName": "gsi_pk", "KeyType": "HASH"},
        {"AttributeName": "gsi_sk", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST

# --- 15. treatment_tracker_introduction_tree_node_videos (pk + sk) ---
run_aws \
  --table-name treatment_tracker_introduction_tree_node_videos \
  --attribute-definitions \
    AttributeName=pk,AttributeType=S \
    AttributeName=sk,AttributeType=S \
  --key-schema AttributeName=pk,KeyType=HASH AttributeName=sk,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

echo "All 15 DynamoDB tables created successfully."
