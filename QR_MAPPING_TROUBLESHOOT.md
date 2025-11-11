# QR Mappings Empty Table - Troubleshooting Guide

## Problem

The `qr_mappings` table in Supabase is **empty** even after registering members using surplus ID card QR codes.

## Root Causes & Solutions

### ❌ Cause 1: Migration Not Applied

**Symptom:** `qr_mappings` table doesn't exist in Supabase

**Solution:**
1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **"New Query"**
4. Copy the entire SQL from `scripts/create-qr-mappings.sql`
5. Run the query
6. You should see: "Created new table" (no error)

**Verify:**
```sql
SELECT COUNT(*) FROM qr_mappings;
```
Should return: `0` (empty table exists)

---

### ❌ Cause 2: Supabase Credentials Not Set

**Symptom:** Environment variables not configured; `isSupabaseConfigured` is `false`

**Check:**
1. Open `.env.local` in your project root
2. Verify these lines exist:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

**If missing:**
1. Go to Supabase dashboard → **Settings** → **API**
2. Copy `Project URL` and `Anon public key`
3. Add them to `.env.local`
4. Restart your development server (`npm run dev` or `pnpm dev`)

**Verify in browser console:**
```javascript
// Open DevTools → Console and run:
console.log(typeof window !== 'undefined' ? 'Client-side' : 'Server-side')
// Then check console logs when registering a member
```

---

### ❌ Cause 3: RLS Policy Blocks Insert/Update

**Symptom:** Upsert fails silently with policy violation error

**Check in Supabase:**
1. Go to **SQL Editor**
2. Run:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'qr_mappings';
   ```

**Expected result:** Should show:
- Policy name: `Allow all operations on qr_mappings`
- Type: `PERMISSIVE`
- Command: `ALL`

**If missing or wrong policy:**
1. Go to **SQL Editor**
2. Run:
   ```sql
   DROP POLICY IF EXISTS "Allow all operations on qr_mappings" ON qr_mappings;
   
   CREATE POLICY "Allow all operations on qr_mappings" ON qr_mappings
     FOR ALL USING (true) WITH CHECK (true);
   ```

---

### ❌ Cause 4: Wrong Column Names in Upsert

**Symptom:** Upsert fails with "column does not exist" error

**Check:** Column names must be snake_case (Supabase convention)
- ✅ `qr_code_id` (not `qrCodeId`)
- ✅ `member_id` (not `memberId`)

**Verify table structure:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'qr_mappings'
ORDER BY ordinal_position;
```

Expected output:
| column_name | data_type |
|------------|-----------|
| qr_code_id | text |
| member_id | uuid |
| event_id | uuid |
| created_at | timestamp with time zone |

---

### ❌ Cause 5: Async Operation Not Completing (Fixed in Latest Code)

**Symptom:** Code looks right, but mappings still not saved

**What was happening (before fix):**
- `saveQRCodeMapping()` launched async IIFE but didn't wait
- Browser might unload before request completes
- Request might fail silently

**What's fixed now:**
- Separated async logic into explicit `persistQRMappingToSupabase()` function
- Better error logging
- Proper async/await flow

**Verify with new code:**
1. Update to latest `lib/storage.ts`
2. Open browser **DevTools → Console**
3. Register a member
4. Look for logs:
   - `"Attempting to upsert QR mapping to Supabase"`
   - `"✅ QR Code mapping successfully persisted to Supabase"` (success)
   - OR error details (if failed)

---

### ❌ Cause 6: Supabase Service Outage or Network Issue

**Symptom:** Logs show network timeout or 503 error

**Check:**
1. Visit [Supabase Status Page](https://status.supabase.com)
2. Are there any incidents reported?

**If network issue:**
- Try again in a few minutes
- Check your internet connection
- Verify browser can reach `your-project.supabase.co`

---

### ❌ Cause 7: Event ID Mismatch (Optional, For Scoped Deployments)

**Symptom:** Mapping saved but can't find it on different device with different event

**If using `event_id` filtering:**
- Ensure both devices use the same event
- Check `saveQRCodeMapping()` passes `event_id` (currently optional)

**Current code:** Doesn't use `event_id`, so skip this unless you customize it

---

## Step-by-Step Debugging

### Step 1: Verify Migration Applied

```sql
-- In Supabase SQL Editor
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_name = 'qr_mappings';
```

Expected: Returns `1`

### Step 2: Check Column Existence

```sql
-- In Supabase SQL Editor
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'qr_mappings';
```

Expected: `qr_code_id`, `member_id`, `event_id`, `created_at`

### Step 3: Verify RLS Policy

```sql
-- In Supabase SQL Editor
SELECT schemaname, tablename, policyname, permissive, qual, with_check
FROM pg_policies 
WHERE tablename = 'qr_mappings';
```

Expected: Policy with `PERMISSIVE` type

### Step 4: Test Manual Insert

```sql
-- In Supabase SQL Editor (use real UUIDs)
INSERT INTO qr_mappings (qr_code_id, member_id)
VALUES ('TEST-QR-123', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid);

SELECT * FROM qr_mappings WHERE qr_code_id = 'TEST-QR-123';
```

If this fails, there's a database issue (RLS, schema, etc.)

### Step 5: Check Browser Console During Registration

1. Open DevTools: **F12 or Cmd+Option+I**
2. Click on **Console** tab
3. Register a member from surplus QR
4. Look for logs starting with:
   - `"QR Code mapping saved to localStorage"`
   - `"Attempting to upsert QR mapping to Supabase"`
   - `"✅ QR Code mapping successfully persisted to Supabase"` OR error

### Step 6: Verify Supabase Data

```sql
-- In Supabase SQL Editor
SELECT * FROM qr_mappings 
ORDER BY created_at DESC 
LIMIT 10;
```

If empty, upsert is not happening. Check console logs for errors.

---

## Browser Console Logs - What They Mean

| Log | Meaning |
|-----|---------|
| `QR Code mapping saved to localStorage` | ✅ Mapping stored locally |
| `Attempting to upsert QR mapping to Supabase` | ⏳ Sending to server |
| `✅ QR Code mapping successfully persisted to Supabase` | ✅ Upsert succeeded |
| `Supabase upsert error: [error details]` | ❌ Upsert failed (check error message) |
| `Table qr_mappings does not exist` | ❌ Migration not applied |
| `Unexpected error while saving QR mapping` | ❌ Network or other error |
| `Supabase client not configured` | ❌ Env vars not set |

---

## Quick Checklist

- [ ] Migration SQL applied in Supabase
- [ ] `qr_mappings` table exists (verify with `SELECT COUNT(*) FROM qr_mappings`)
- [ ] Environment variables set: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] RLS policy allows insert/update (should be permissive: `true WITH CHECK true`)
- [ ] Column names are correct (snake_case: `qr_code_id`, `member_id`)
- [ ] Latest code from `lib/storage.ts` is in use
- [ ] Development server restarted after env var changes
- [ ] Browser console shows upsert success logs
- [ ] Supabase shows row inserted (SELECT * FROM qr_mappings)
- [ ] Same QR scanned on different device now finds member

---

## Testing Commands

**Run diagnostics script:**
```bash
node scripts/check-qr-mappings.js
```

This will check:
- Environment variables
- Migration file existence
- Code changes
- RLS policies
- Common issues

---

## If Still Not Working

**Get detailed logs:**

1. **In .env.local**, add (temporarily):
   ```
   DEBUG=*
   ```

2. **In browser DevTools**, go to **Network** tab

3. **Register a member**, then:
   - Check console for all logs (especially red/yellow warnings)
   - In Network tab, look for failed requests to `supabase.co`
   - Note any 4xx or 5xx errors

4. **Provide details:**
   - Exact error message from console
   - Network request details
   - Supabase project URL (first part before `.supabase.co`)

---

## Success Indicators

After applying the fix, you should see:

### Console Logs (when registering)
```
QR Code mapping saved to localStorage: {qrCodeId: "SURPLUS-1234...", memberId: "uuid..."}
Attempting to upsert QR mapping to Supabase: {qrCodeId: "SURPLUS-...", memberId: "uuid..."}
✅ QR Code mapping successfully persisted to Supabase: {qrCodeId: "...", memberId: "..."}
```

### Supabase Data (SELECT * FROM qr_mappings)
```
qr_code_id           | member_id                           | event_id | created_at
SURPLUS-1234567890-1 | 550e8400-e29b-41d4-a716-446655440000 | NULL     | 2025-11-11 10:30:45
```

### Cross-Device Test
- Register on Device A
- Scan same QR on Device B
- Member found ✅

---

## Support

For additional help:
- Check `QR_MAPPING_QUICK_START.md` for overview
- Check `QR_MAPPING_SYNC.md` for technical details
- Check `IMPLEMENTATION_COMPLETE.md` for architecture
