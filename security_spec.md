# Security Specification for TurboDrop

## Data Invariants
1. A user can only access and modify their own profile.
2. An airdrop must belong to a user.
3. A folder must belong to an airdrop and match the user's ID.
4. A task must belong to a folder and an airdrop, and match the user's ID.
5. Timestamps (`createdAt`, `updatedAt`) must be server-generated or validated.

## The "Dirty Dozen" Payloads (Deny Cases)
1. Creating an airdrop with a different `ownerId`.
2. Updating an airdrop's `ownerId` to someone else.
3. Reading another user's airdrops.
4. Creating a task in another user's folder.
5. Injected "ghost fields" (e.g., ` isAdmin: true `) in user settings.
6. Oversized trial names (e.g., name > 255 chars).
7. Invalid status enum in airdrop.
8. Deleting someone else's task.
9. Modifying `createdAt` field on update.
10. Creating a folder with an invalid `difficulty` enum.
11. Injecting jumbo script strings into `task.url`.
12. Massively large `steps` array in a task (> 100 steps).

## Target Schema & Rules
I will implement `isValidAirdrop`, `isValidFolder`, and `isValidTask` helpers that check for these constraints.
