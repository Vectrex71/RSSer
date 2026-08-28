# Firestore Security Specification

## Data Invariants
1. **User Identity Bind**: All documents in `/users/{userId}` must strictly belong to the user whose `uid` matches `{userId}`.
2. **Resource Ownership**: Sub-resources like `feeds`, `blogs`, `votes`, `comments` must be owned by the creator.
3. **Role-Based Access**: Only users in the `admins` collection (or the hardcoded master email) can write to global config/announcements.
4. **Public Readability**: `announcements`, `publicSources`, and `published` blogs are readable by anyone.
5. **Immutability**: `createdAt` fields must never change after creation.

## The "Dirty Dozen" Payloads (Target: PERMISSION_DENIED)

| # | Operation | Collection | Payload / Condition | Reason for Denial |
|---|-----------|------------|---------------------|-------------------|
| 1 | `create` | `users` | `{ "uid": "attacker_id", "email": "victim@example.com" }` to path `/users/victim_id` | Identity Spoofing |
| 2 | `update` | `users` | `{ "plan": "yearly" }` on `/users/victim_id` by another user | Unauthorized modification |
| 3 | `create` | `announcements` | `{ "content": { "de": "Hack!" }, "createdAt": "..." }` by non-admin | Privilege Escalation |
| 4 | `create` | `users/{uid}/feeds` | `{ "userId": "victim_id", "url": "..." }` by attacker | Resource Poisoning |
| 5 | `update` | `publicSources` | `{ "url": "evil.com" }` on source owned by someone else | Identity Hijack |
| 6 | `create` | `messages` | `{ "userId": "victim_id", ... }` | Identity Spoofing |
| 7 | `update` | `announcements` | `{ "content": { "de": "A".repeat(1000000) } }` | Denial of Wallet (Size) |
| 8 | `write` | `admins` | Any write by a non-admin | Privilege Escalation |
| 9 | `list` | `users` | Attempt to list all users | PII Leak |
| 10| `create` | `users/{uid}/blogs/{id}/votes` | `{ "userId": "victim_id", ... }` | Identity Spoofing |
| 11| `update` | `users/{uid}/blogs/{id}` | Changing `published` on another's blog | Unauthorized modification |
| 12| `create` | `publicRssCache` | Malicious cache injection by non-signed-in | Unauthenticated Write |

## Test Runner (firestore.rules.test.ts)

To be implemented to verify these constraints.
