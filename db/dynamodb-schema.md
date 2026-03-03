# DynamoDB Schema — Treatment Tracker

This document defines the DynamoDB table design for the treatment-tracker app. All tables use **String** type for partition and sort keys unless noted.

**Conventions:**
- **pk** = partition key attribute name  
- **sk** = sort key attribute name (optional)  
- Value patterns use `<id>`, `<user_id>`, etc. as placeholders for actual UUIDs or strings.

---

## 1. treatment_tracker_users

One item per user. No sort key.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `USER#<id>` |

**Attributes:** `id`, `email`, `name`, `created_at`

**GSI: gsi_email** (get user by email for login)
| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `gsi_pk` | String | `EMAIL` |
| Sort key | `gsi_sk` | String | `<email>` (lowercase) |

Store `gsi_pk` = `"EMAIL"` and `gsi_sk` = email on each user item so you can Query by email.

---

## 2. treatment_tracker_nodes

One item per content node. No sort key.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `NODE#<id>` |

**Attributes:** `id`, `key`, `title`, `summary`, `is_root`, `order_index`, `pos_x`, `pos_y`, `box_width`, `box_height`, `created_at`, `updated_at`

**GSI: gsi_key** (get node by key, e.g. root)
| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `gsi_pk` | String | `NODE_KEY` |
| Sort key | `gsi_sk` | String | `<key>` |

Store `gsi_pk` = `"NODE_KEY"` and `gsi_sk` = key on each node item.

---

## 3. treatment_tracker_node_categories

Multiple categories per node. Sort key = category.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `NODE#<node_id>` |
| Sort key | `sk` | String | `CATEGORY#<category>` |

**Attributes:** `node_id`, `category`, `created_at`  
Valid categories: `skincare`, `nutrition`, `oral_care`, `pain`

**Optional GSI: gsi_category** (list nodes by category)
| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `gsi_pk` | String | `CATEGORY` |
| Sort key | `gsi_sk` | String | `<category>#<node_id>` |

---

## 4. treatment_tracker_node_videos

Multiple videos per node. Sort key = video id.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `NODE#<node_id>` |
| Sort key | `sk` | String | `VIDEO#<video_id>` |

**Attributes:** `id`, `node_id`, `video_url`, `title`, `order_index`, `created_at`, `updated_at`

---

## 5. treatment_tracker_edges

One item per edge. No sort key.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `EDGE#<id>` |

**Attributes:** `id`, `parent_id`, `child_id`, `unlock_type`, `unlock_value`, `description`, `weight`, `created_at`  
`unlock_type`: `always` \| `manual` \| `symptom_match`

**GSI: gsi_child** (edges where child_id = X — unlock checks). Each edge needs its own GSI key attributes.
| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `gsi_child_pk` | String | `<child_id>` |
| Sort key | `gsi_child_sk` | String | `<id>` (edge id, for uniqueness) |

**GSI: gsi_parent** (edges where parent_id = X)
| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `gsi_parent_pk` | String | `<parent_id>` |
| Sort key | `gsi_parent_sk` | String | `<id>` |

**GSI: gsi_unlock_type** (e.g. all `always` edges for auto-unlock)
| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `gsi_unlock_type_pk` | String | `<unlock_type>` |
| Sort key | `gsi_unlock_type_sk` | String | `<id>` |

Store these six attributes on each edge so you can Query by child, parent, or unlock_type.

---

## 6. treatment_tracker_symptoms

One item per symptom. No sort key.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `SYMPTOM#<id>` |

**Attributes:** `id`, `key`, `label`, `description`

**GSI: gsi_key** (get symptom by key; batch get by keys)
| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `gsi_pk` | String | `SYMPTOM_KEY` |
| Sort key | `gsi_sk` | String | `<key>` |

---

## 7. treatment_tracker_user_unlocked_nodes

Multiple unlocks per user. Sort key = node_id.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `USER#<user_id>` |
| Sort key | `sk` | String | `UNLOCK#<node_id>` |

**Attributes:** `id`, `user_id`, `node_id`, `unlocked_at`, `unlocked_by`, `source`  
`unlocked_by`: `user` \| `admin` \| `system`

**Optional GSI: gsi_node** (unlocks by node_id)
| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `gsi_pk` | String | `NODE` |
| Sort key | `gsi_sk` | String | `<node_id>` |

---

## 8. treatment_tracker_user_events

Multiple events per user. Sort key supports time ordering.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `USER#<user_id>` |
| Sort key | `sk` | String | `EVENT#<created_at_iso>#<id>` |

Use ISO timestamp in sort key for chronological order. **Attributes:** `id`, `user_id`, `type`, `metadata`, `created_at`

---

## 9. treatment_tracker_category_videos

All category videos in one logical partition; sort key = category + order.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `CATEGORY_VIDEO` |
| Sort key | `sk` | String | `<category>#<order_index>#<id>` |

**Attributes:** `id`, `category`, `video_url`, `title`, `order_index`, `created_at`, `updated_at`  
Valid categories: `skincare`, `nutrition`, `oral_care`, `pain`

---

## 10. treatment_tracker_category_positions

One position per category.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `CATEGORY_POSITION` |
| Sort key | `sk` | String | `<category>` |

**Attributes:** `category`, `pos_x`, `pos_y`, `width`, `height`, `created_at`, `updated_at`

---

## 11. treatment_tracker_symptom_positions

Multiple positions keyed by position_key.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `SYMPTOM_POSITION` |
| Sort key | `sk` | String | `<position_key>` |

**Attributes:** `id`, `position_key`, `pos_x`, `pos_y`, `width`, `height`, `created_at`, `updated_at`

---

## 12. treatment_tracker_bonus_content_videos

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `BONUS_VIDEO` |
| Sort key | `sk` | String | `<category>#<order_index>#<id>` |

**Attributes:** `id`, `category`, `video_url`, `title`, `order_index`, `created_at`, `updated_at`  
Valid categories: `skincare`, `nutrition`, `oral_care`, `introduction`

---

## 13. treatment_tracker_bonus_content_positions

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `BONUS_POSITION` |
| Sort key | `sk` | String | `<category>` |

**Attributes:** `category`, `pos_x`, `pos_y`, `width`, `height`, `created_at`, `updated_at`

---

## 14. treatment_tracker_introduction_tree_nodes

One item per intro tree node. No sort key.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `INTRO_NODE#<id>` |

**Attributes:** `id`, `node_key`, `title`, `pos_x`, `pos_y`, `width`, `height`, `created_at`, `updated_at`

**GSI: gsi_node_key** (get intro node by node_key)
| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `gsi_pk` | String | `INTRO_NODE_KEY` |
| Sort key | `gsi_sk` | String | `<node_key>` |

---

## 15. treatment_tracker_introduction_tree_node_videos

Multiple videos per intro node.

| Key | Attribute name | Type | Value pattern |
|-----|----------------|------|----------------|
| Partition key | `pk` | String | `INTRO_NODE#<node_id>` |
| Sort key | `sk` | String | `VIDEO#<video_id>` |

**Attributes:** `id`, `node_id`, `video_url`, `title`, `order_index`, `created_at`, `updated_at`

---

## Summary: Tables and keys

| Table | pk attribute | pk value pattern | sk attribute | sk value pattern |
|-------|--------------|------------------|--------------|-------------------|
| treatment_tracker_users | pk | USER#&lt;id&gt; | — | — |
| treatment_tracker_nodes | pk | NODE#&lt;id&gt; | — | — |
| treatment_tracker_node_categories | pk | NODE#&lt;node_id&gt; | sk | CATEGORY#&lt;category&gt; |
| treatment_tracker_node_videos | pk | NODE#&lt;node_id&gt; | sk | VIDEO#&lt;video_id&gt; |
| treatment_tracker_edges | pk | EDGE#&lt;id&gt; | — | — |
| treatment_tracker_symptoms | pk | SYMPTOM#&lt;id&gt; | — | — |
| treatment_tracker_user_unlocked_nodes | pk | USER#&lt;user_id&gt; | sk | UNLOCK#&lt;node_id&gt; |
| treatment_tracker_user_events | pk | USER#&lt;user_id&gt; | sk | EVENT#&lt;ts&gt;#&lt;id&gt; |
| treatment_tracker_category_videos | pk | CATEGORY_VIDEO | sk | &lt;category&gt;#&lt;order&gt;#&lt;id&gt; |
| treatment_tracker_category_positions | pk | CATEGORY_POSITION | sk | &lt;category&gt; |
| treatment_tracker_symptom_positions | pk | SYMPTOM_POSITION | sk | &lt;position_key&gt; |
| treatment_tracker_bonus_content_videos | pk | BONUS_VIDEO | sk | &lt;category&gt;#&lt;order&gt;#&lt;id&gt; |
| treatment_tracker_bonus_content_positions | pk | BONUS_POSITION | sk | &lt;category&gt; |
| treatment_tracker_introduction_tree_nodes | pk | INTRO_NODE#&lt;id&gt; | — | — |
| treatment_tracker_introduction_tree_node_videos | pk | INTRO_NODE#&lt;node_id&gt; | sk | VIDEO#&lt;video_id&gt; |

---

## Programmatic creation (AWS CLI)

From the project root, with the [AWS CLI](https://docs.aws.amazon.com/cli/) installed and configured (`aws configure`), run:

```bash
# Optional: set region
export AWS_REGION=us-east-1

# Create all 15 tables (and GSIs)
chmod +x db/create-dynamodb-tables.sh
./db/create-dynamodb-tables.sh
```

The script uses **on-demand** billing (`PAY_PER_REQUEST`). If a table already exists, that step will fail; delete the table in the console or via `aws dynamodb delete-table` if you need to re-run.

---

## Creating tables in AWS Console

For each table:
1. **Table name:** use the exact name from the table above.
2. **Partition key:** name = `pk`, type = **String**.
3. **Sort key:** if the table has an **sk** row above, name = `sk`, type = **String**; otherwise leave sort key empty.
4. After the table is created, add any **GSI** listed for that table (Create index: partition key and sort key attribute names and types as in the doc; use `gsi_pk` / `gsi_sk` for GSI key attributes where specified).
