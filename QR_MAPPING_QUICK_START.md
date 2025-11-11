# QR Mapping Sync - Quick Start & Verification

## What Was Fixed

When a member is registered from a surplus ID card in the **"Register Member From QR"** dialog on the Attendance page:
- The scanned QR code ID (e.g., `SURPLUS-1234567890-001`) is now mapped to the member's database ID
- This mapping is **persisted to Supabase** (in the `qr_mappings` table)
- Security and Catering sections can now find the member when the same QR code is scanned on **any device**

## ⚠️ If Your qr_mappings Table is Empty

**Common causes:**
1. Migration SQL not run (see Step 1 below)
2. Supabase credentials not set in `.env.local`
3. RLS policy blocks insert/update
4. Old code not updated yet

**Solution:** Follow the 3 steps below in order.

---

## Quick Setup (3 Steps)

### Step 0: Update Code (If Not Already Done)

The code has been fixed to properly save mappings to Supabase. If you haven't already:

1. Pull/update your code to get the latest `lib/storage.ts`
2. Verify `persistQRMappingToSupabase()` function exists in `lib/storage.ts`
3. Restart your development server: `pnpm dev` (or `npm run dev`)

### Step 1: Create the qr_mappings Table

Open your Supabase project:
1. Go to **SQL Editor**
2. Click **"New Query"**
3. Paste the SQL from `scripts/create-qr-mappings.sql`
4. Click **"Run"**

Expected result: No errors, table created.

### Step 2: Verify the Setup

In the Supabase SQL Editor, run:
```sql
SELECT * FROM qr_mappings LIMIT 1;
```

Expected result: Empty table (0 rows) - that's normal, mappings are created as members are registered.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    ATTENDANCE PAGE (Any Device)                  │
│                                                                   │
│  1. User scans surplus QR code: SURPLUS-1234567890-001           │
│  2. EditMemberDialog form appears                                │
│  3. User fills: Name, Tanzeem, Region, Jamaat                    │
│  4. Clicks "Save & Add to Attendance"                            │
│  5. Backend:                                                      │
│     - Saves member to tajneed_members (gets UUID)                │
│     - Calls saveQRCodeMapping("SURPLUS-...", <UUID>)             │
│       → Saves to Supabase qr_mappings table ✅                   │
│     - Adds attendance record                                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓ Network Sync ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY PAGE (Different Device)              │
│                                                                   │
│  1. User scans same QR: SURPLUS-1234567890-001                   │
│  2. Backend:                                                      │
│     - Calls findAttendanceRecordByQRCodeId(qr_code)             │
│     - Which calls getMemberIdFromQRCode(qr_code) [async]        │
│       → Queries Supabase qr_mappings table ✅                    │
│       → Gets mapped UUID                                          │
│     - Finds attendance record with that UUID                     │
│     - Toggles status (In/Out)                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Testing Checklist

### ✅ Single Device Test
- [ ] Start the app
- [ ] Register a member from surplus QR (Attendance page)
  - [ ] Open camera, scan QR code
  - [ ] Fill form and save
- [ ] Go to Security page
  - [ ] Click "Scan QR Code"
  - [ ] Scan the same QR → Member should be found
  - [ ] Toggle status (In/Out) should work
- [ ] Go to Catering page → Check page
  - [ ] Click "Scan QR Code"
  - [ ] Scan the same QR → Member should be marked as served

### ✅ Cross-Device Test (if you have 2 browsers/devices)

**Device A:**
- [ ] Register a member from surplus QR code (Attendance page)
- [ ] Note the member name and QR code

**Device B:**
- [ ] Go to Security page
  - [ ] Scan the member's QR code
  - [ ] Member should be found (even though registered on Device A)
  - [ ] Status toggle should work
- [ ] Go to Catering check page
  - [ ] Scan the member's QR code
  - [ ] Member should be marked as served

**Device A (refresh):**
- [ ] Go to Security page
- [ ] See the status change from Device B ✅ (proves sync worked)

### ✅ Verify Database Persistence

In Supabase SQL Editor:
```sql
SELECT COUNT(*) as mapping_count FROM qr_mappings;
```

After registering a member, count should increase.

### ✅ Verify Mapping Details

```sql
SELECT qr_code_id, member_id, created_at 
FROM qr_mappings 
ORDER BY created_at DESC 
LIMIT 5;
```

You should see the QR codes you've scanned and their mapped member IDs.

## Troubleshooting

| Symptom | Cause | Solution |
|---------|-------|----------|
| "Member not found" in Security/Catering | Migration not run or member not registered | 1. Check `qr_mappings` table exists (run migration)<br>2. Register member first on Attendance page |
| Works on Device A, not on Device B | Mapping saved to localStorage only | Run the migration SQL to enable Supabase sync |
| Errors in browser console about qr_mappings | Table doesn't exist | Run `scripts/create-qr-mappings.sql` in Supabase SQL editor |
| Mapping saved but taking time to appear on other device | Network latency | Wait a few seconds and refresh |

## Code Changes Summary

| File | Change | Impact |
|------|--------|--------|
| `lib/storage.ts` | `saveQRCodeMapping()` now upserts to Supabase | QR mappings persist server-side |
| `lib/storage.ts` | `getMemberIdFromQRCode()` now async, queries Supabase | Mappings read cross-device |
| `lib/storage.ts` | `findMemberByQRCodeId()` awaits async lookup | Properly handles Supabase queries |
| `app/attendance/page.tsx` | Await async mapping check | Respects mappings from other devices |
| `scripts/create-qr-mappings.sql` | New migration file | Enables cross-device sync (must be run) |

## Files to Check

- ✅ `lib/storage.ts` — Core mapping logic
- ✅ `app/attendance/page.tsx` — Registration flow
- ✅ `app/security/page.tsx` — Security scan (auto-sync via existing code)
- ✅ `app/catering/check/page.tsx` — Catering scan (auto-sync via existing code)
- ✅ `scripts/create-qr-mappings.sql` — Migration (must be run in Supabase)
- ✅ `QR_MAPPING_SYNC.md` — Detailed documentation

## Next Steps

1. **Run the migration** (if not done): `scripts/create-qr-mappings.sql` in Supabase SQL Editor
2. **Test** using the checklist above
3. **Deploy** to production with confidence — QR mappings are now synced across all devices

---

**Questions?** See `QR_MAPPING_SYNC.md` for detailed documentation.
