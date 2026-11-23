# Security Specification — Ju Nail Designer (Firestore Rules)

## 1. Data Invariants & Relationship Mapping

1. **Master Source of Truth for Owner Role**: Access to administrative operations is verified via `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or the verified bootstrapped owner email (`request.auth.token.email == 'egabi4125@gmail.com' && request.auth.token.email_verified == true`). Client self-registration can never write to `/admins/{uid}`.
2. **PII Isolation**: `/clients/{clientId}` and `/appointments/{appointmentId}` contain PII (`phone`, `email`, `name`). Clients can only read their own documents (`request.auth.uid == clientId` or `resource.data.clientId == request.auth.uid`). Public slot availability is split into `/slots/{YYYY-MM-DD_HH-MM}`, which stores zero PII.
3. **Atomicity Guarantee**: A client creating an `/appointments/{id}` MUST atomically create the corresponding `/slots/{YYYY-MM-DD_HH-MM}` and `/clientDayLocks/{uid_YYYY-MM-DD}` in the same write batch (`existsAfter`).
4. **One Booking Per Client Per Day**: `/clientDayLocks/{uid_YYYY-MM-DD}` enforces that a client cannot hold two active reservations on the same calendar date.
5. **Terminal State Locking**: Once an appointment moves out of `confirmed` (`completed`, `cancelled_free`, `cancelled_fee_pending`, `cancelled_fee_paid`), clients cannot mutate it again. Only the owner (`isAdmin()`) can override or mark fees paid.
6. **Financial Exclusivity**: `/finances/{id}` is completely unreadable and unwritable by clients; only `isAdmin()` has access.
7. **Temporal & Volumetric Integrity**: Every `createdAt` / `updatedAt` timestamp must equal `request.time`. Every string and list has explicit `.size()` boundaries and regex guards on IDs.

## 2. The "Dirty Dozen" Adversarial Payloads (All MUST Return PERMISSION_DENIED)

1. **P1 — Shadow Field Injection on Client Profile**: Client attempts to create `/clients/{uid}` with extra field `isAdmin: true`.
2. **P2 — Identity Spoofing on Appointment**: Authenticated client A tries to create `/appointments/apt_spoof` with `clientId: "client_B"`.
3. **P3 — Orphaned Appointment Without Slot/DayLock**: Client tries to create `/appointments/apt_orphan` standalone without creating `/slots/{slotId}` and `/clientDayLocks/{lockId}` atomically.
4. **P4 — Privilege Escalation via Admin Collection**: Client tries to write `/admins/{uid}` with `{ uid, role: "owner" }`.
5. **P5 — Email Spoofing Without Verification**: Unverified user (`email_verified: false`) attempts to write `/studio/config` even if email matches owner.
6. **P6 — PII Scraping on Clients**: Client A executes `get` or `list` on `/clients/{clientB}` or `/clients`.
7. **P7 — Client Reading Finances**: Client A attempts `get` or `list` on `/finances`.
8. **P8 — Terminal State Tampering**: Client tries to revert a `cancelled_fee_pending` appointment back to `confirmed` or set `status: "completed"`.
9. **P9 — Value Poisoning on Cancel Action**: Client tries to update `servicePrice: 0` or `bookingFeePaid: true` during cancellation.
10. **P10 — Resource Poisoning (1MB String / Bad ID)**: Client attempts to write a 2000-char string into `notes` or an invalid path ID `../bad$id`.
11. **P11 — Client Forging Closures**: Client attempts to create `/closures/block_1` to close the studio agenda.
12. **P12 — Deleting Another Client's Slot**: Client A attempts to delete `/slots/2026-12-01_10-00` owned by Client B.
