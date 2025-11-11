# QR Code Mapping Synchronization

## Overview

This document explains how QR code → member ID mappings are now synchronized across all devices using Supabase, ensuring that members registered from surplus ID cards in the "Register Member From QR" dialog can be found consistently by the Security and Catering sections on any device.

## The Problem (Solved)

Previously, when a member was registered from a surplus ID card:
1. The QR code ID was scanned (e.g., `SURPLUS-1234567890-001`)
2. The member details were filled in and saved to the database, generating a real member ID (UUID)
3. A mapping between the QR code ID and the generated member ID was stored **only in localStorage**
4. On a different device, scanning the same QR code would not find the mapping, causing "Member not found" errors in Security/Catering sections

## The Solution

QR mappings are now persisted to Supabase in a dedicated `qr_mappings` table, making them available across all devices that share the same database.

### Workflow

**Registration (Attendance Page)**
```
1. User scans surplus QR code ID (e.g., SURPLUS-xxx)
2. EditMemberDialog opens
3. User fills member details and clicks "Save & Add to Attendance"
4. saveTajneedMemberWithId() saves member to DB (may generate new UUID)
5. saveQRCodeMapping(qrCodeId, memberId) is called
   → Saves to localStorage (immediate)
   → Attempts to save to Supabase qr_mappings table (async, non-blocking)
6. addAttendanceRecord() adds attendance record
```

**Security/Catering Check (Both Pages)**
```
1. User scans QR code (same surplus ID or a mapped ID)
2. handleQRScan() calls findAttendanceRecordByQRCodeId(scannedText)
3. findAttendanceRecordByQRCodeId() internally calls:
   a. findMemberByQRCodeId(scannedText)
   b. Which calls getMemberIdFromQRCode(scannedText) [now async]
   c. getMemberIdFromQRCode() queries:
      - Supabase qr_mappings table first (cross-device)
      - Falls back to localStorage if Supabase unavailable
4. Member is found and necessary action is taken (toggle status, mark as served, etc.)
```

## Implementation Details

### Modified Files

#### `lib/storage.ts`

**`saveQRCodeMapping(qrCodeId: string, memberId: string)`**
- Saves mapping to localStorage immediately
- If Supabase is configured, asynchronously attempts upsert into `qr_mappings` table
- Logs warnings if Supabase persistence fails, but does not throw (graceful degradation)

**`getMemberIdFromQRCode(qrCodeId: string): Promise<string | null>`** (now async)
- Queries `qr_mappings` table in Supabase if configured
- Falls back to localStorage lookup if:
  - Supabase is not configured
  - Query fails (e.g., table doesn't exist)
  - No mapping found
- Returns the mapped member ID or null

**`findMemberByQRCodeId(qrCodeId: string): Promise<TajneedMember | null>`**
- Updated to `await` the now-async `getMemberIdFromQRCode()`

#### `app/attendance/page.tsx`

**`handleEditMemberSave()` callback**
- Updated to `await` `getMemberIdFromQRCode()` when verifying existing mappings
- Ensures QR mappings from other devices are respected before overwriting

#### `app/security/page.tsx`

**`handleQRScan()`**
- Already uses `findAttendanceRecordByQRCodeId()` which now queries Supabase
- No changes needed; works automatically

#### `app/catering/check/page.tsx`

**`handleQRScan()`**
- Already uses `findAttendanceRecordByQRCodeId()` which now queries Supabase
- No changes needed; works automatically

### Database Migration

A new `qr_mappings` table must be created in Supabase to enable cross-device synchronization:

**SQL Migration** (in `scripts/create-qr-mappings.sql`)
```sql
CREATE TABLE IF NOT EXISTS qr_mappings (
  qr_code_id TEXT PRIMARY KEY,
  member_id UUID NOT NULL,
  event_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_mappings_member_id ON qr_mappings(member_id);

ALTER TABLE qr_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on qr_mappings" ON qr_mappings
  FOR ALL USING (true) WITH CHECK (true);
```

**How to Apply**
- Open your Supabase project → SQL editor
- Copy the SQL from `scripts/create-qr-mappings.sql`
- Run the migration
- The table is now available; mappings will be persisted automatically

## Behavior

### With Supabase Configured (After Migration)

✅ **Registration**
- QR mappings are saved to both localStorage and Supabase immediately
- Availability: Local + cloud

✅ **Security/Catering Check on Same Device**
- QR lookup queries Supabase first; finds mapping from same session
- Fallback to localStorage if DB offline
- Availability: Robust; works offline (uses local cache)

✅ **Security/Catering Check on Different Device**
- QR lookup queries Supabase; finds mapping from **other device**
- Member is found cross-device without re-registration
- Availability: Cross-device sync enabled

### With Supabase Configured (Before Migration)

⚠️ **Registration**
- QR mappings are saved to localStorage
- Supabase save attempt fails silently (table not found)
- Availability: Local only

⚠️ **Security/Catering Check on Same Device**
- Works fine (uses localStorage mapping)

❌ **Security/Catering Check on Different Device**
- Mapping not found (not in Supabase yet)
- "Member not found" error shown

**Resolution**: Run the migration SQL to enable cross-device sync.

### Without Supabase (Offline / Demo Mode)

✅ **Registration**
- QR mappings are saved to localStorage only
- Availability: Local only

✅ **Security/Catering Check on Same Device**
- Works fine (uses localStorage mapping)

❌ **Security/Catering Check on Different Device**
- Mapping not found (not shared across browsers)
- "Member not found" error shown

**Note**: Cross-device sync requires Supabase. Single-device deployments work fine with localStorage-only mode.

## Testing the Feature

### Test Case 1: Single Device
1. Start the app (any mode)
2. Register a member from a surplus QR code on the Attendance page
3. Go to Security page, scan the same QR code → Member should be found and status toggled
4. Go to Catering page, scan the same QR code → Member should be marked as served

### Test Case 2: Cross-Device (Supabase with Migration Applied)
1. **Device A**: Register a member from surplus QR code on Attendance page
2. **Device B**: 
   - Go to Security page, scan the same QR code → Member should be found and status toggled
   - Go to Catering page, scan the same QR code → Member should be marked as served
3. **Device A**: Refresh Security page → See updated status from Device B

### Test Case 3: Offline Behavior (Supabase with Migration, But No Network)
1. **Device A**: Register a member from surplus QR code
2. **Device B** (offline): Try to scan QR code in Security → "Member not found" (expected; mapping not cached)
3. **Device B** comes online → Refresh and try again → Member should now be found (mapping synced)

## Troubleshooting

### "Member not found" Error in Security/Catering

**Check 1: Was the member registered?**
- Go to Attendance page → Search for the member name
- If not found, register the member first

**Check 2: Is the Supabase migration applied?** (if cross-device sync expected)
- Open Supabase dashboard → SQL editor
- Run: `SELECT COUNT(*) FROM qr_mappings;`
- If error "table does not exist", run `scripts/create-qr-mappings.sql`

**Check 3: Is Supabase configured?**
- Check `.env.local` for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- If not set, app falls back to localStorage (single-device mode)

**Check 4: Is there network connectivity?**
- If offline, cross-device sync won't work; try again when online

### Mapping Saved Locally but Not to Supabase

- Check browser console for warnings like "Could not persist QR mapping to Supabase"
- This is expected if:
  - Migration not run yet (table doesn't exist)
  - Supabase credentials not configured
  - Network error (will retry on next registration)
- App continues to work with localStorage; no user-facing error

## Future Enhancements

1. **Admin UI**: View and manage all QR mappings
2. **Scoped Mappings**: Link mappings to specific events (add `event_id` filter)
3. **Re-sync Tool**: Bulk sync all localStorage mappings to Supabase
4. **Audit Log**: Track when mappings are created/updated and by whom
