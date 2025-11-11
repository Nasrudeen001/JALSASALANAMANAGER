# Event ID Fix - Quick Verification Guide

## The Fix
✅ Updated QR mapping storage to include `event_id` from Supabase

## What Changed
- `saveQRCodeMapping()` now captures current event ID
- `persistQRMappingToSupabase()` now saves event ID with mapping
- `getMemberIdFromQRCode()` now filters by event ID for event-specific lookups

## Before the Fix
```
QR mapping saved: {qr_code_id: "test-qr", member_id: "uuid"}
Supabase stored: event_id = NULL ❌
```

## After the Fix
```
QR mapping saved: {qr_code_id: "test-qr", member_id: "uuid", event_id: "event-uuid"}
Supabase stored: event_id = "event-uuid" ✅
```

## How to Test

### Step 1: Create Event
1. Go to Settings → Create Event
2. Create "Test Event A"

### Step 2: Register Member via QR
1. Go to Attendance → Scan QR Code
2. Scan/enter: `test-qr-001`
3. Fill member details and save

### Step 3: Verify in Supabase
```sql
SELECT qr_code_id, member_id, event_id 
FROM qr_mappings 
WHERE qr_code_id = 'test-qr-001';
```

**Expected**: Shows event_id (not NULL) ✅

### Step 4: Test Event Isolation (Optional)
1. Create "Test Event B"
2. Register different member with same QR: `test-qr-001`
3. Run same query - should see TWO rows:
   - One for Event A
   - One for Event B
4. Switch between events and scan - should find different members

## Expected Console Logs

```
[Attempt 1/3] Attempting to upsert QR mapping to Supabase: {
  qrCodeId: "test-qr-001",
  memberId: "uuid-member",
  eventId: "uuid-event" ✅
}
✅ QR Code mapping successfully persisted to Supabase: {
  qrCodeId: "test-qr-001",
  memberId: "uuid-member",
  eventId: "uuid-event"
}
```

## Verify Query Results

Run in Supabase SQL Editor:
```sql
-- Should show recent mappings with proper event_id
SELECT 
  qr_code_id,
  member_id,
  event_id,
  created_at
FROM qr_mappings
WHERE event_id IS NOT NULL  -- Should have values now
ORDER BY created_at DESC
LIMIT 10;
```

## Status
✅ Code changes complete
✅ No errors
✅ Ready for testing
✅ Backward compatible

Test it and let me know if the event_id is now properly populated!
