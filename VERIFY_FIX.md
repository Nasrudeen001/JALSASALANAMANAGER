# Verify QR Mapping Fix - Step by Step

## Quick Verification (5 Minutes)

Follow these exact steps to confirm the fix is working:

### Step 1: Check Latest Code

```bash
# Verify persistQRMappingToSupabase function exists
grep -n "persistQRMappingToSupabase" lib/storage.ts
```

Expected output:
```
127:const persistQRMappingToSupabase = async (qrCodeId: string, memberId: string) => {
```

If not found, **pull latest code** for `lib/storage.ts`

### Step 2: Verify Environment

Create/update `.env.local`:

```bash
# View current .env.local
cat .env.local | grep NEXT_PUBLIC_SUPABASE
```

Expected output:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
```

If empty or missing, **add both lines** with your actual Supabase credentials.

### Step 3: Run Migration (If Not Done)

In **Supabase Dashboard → SQL Editor**:

```sql
-- Verify table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'qr_mappings'
);
```

Expected: Returns `t` (true)

If returns `f` (false):
1. Open `scripts/create-qr-mappings.sql`
2. Copy entire contents
3. Paste into Supabase SQL Editor
4. Click **"Run"**

### Step 4: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
# Then restart:
pnpm dev
# or
npm run dev
```

Wait for "ready on http://localhost:3000"

### Step 5: Test Registration

1. **Open browser DevTools**: `F12` or `Cmd+Option+I`
2. **Go to Console tab**
3. **Go to Attendance page**
4. **Click "Scan QR Code" button**
5. **Scan any surplus QR code** (or manually enter one for testing)
6. **Fill in member details** (Name, Tanzeem, Region, Jamaat)
7. **Click "Save & Add to Attendance"**

### Step 6: Check Console Logs

Look for these three logs **in order**:

```
[1] QR Code mapping saved to localStorage: {qrCodeId: "SURPLUS-...", memberId: "..."}
[2] Attempting to upsert QR mapping to Supabase: {qrCodeId: "SURPLUS-...", memberId: "..."}
[3] ✅ QR Code mapping successfully persisted to Supabase: {qrCodeId: "SURPLUS-...", memberId: "..."}
```

**If you see all three** ✅ → **Fix is working!**

**If you see [1] and [2] but NOT [3]** → Check next section (error debugging)

**If you see only [1]** → Supabase not configured; check `.env.local`

### Step 7: Verify in Supabase

In **Supabase Dashboard → SQL Editor**:

```sql
SELECT COUNT(*) as new_mappings FROM qr_mappings 
WHERE created_at > now() - interval '5 minutes';
```

Expected: Returns `1` or more (shows recently created mappings)

If returns `0`: Upsert didn't complete; see error debugging below.

---

## Error Debugging

### Scenario 1: Console Shows Upsert Error

**Console log:**
```
Supabase upsert error: {errorMessage: "...", errorDetails: "...", errorCode: "42P01"}
```

**Error Code 42P01** means: Table doesn't exist

**Fix:**
1. Run migration: `scripts/create-qr-mappings.sql` in Supabase SQL Editor
2. Restart dev server
3. Re-register member

### Scenario 2: "Supabase client not configured"

**Console log:**
```
Supabase client not configured
```

**Fix:**
1. Check `.env.local` has both:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Restart dev server
3. Re-register member

### Scenario 3: "Column does not exist" Error

**Console log:**
```
Supabase upsert error: errorCode: "42703"
```

**This means:** Column name is wrong (probably camelCase instead of snake_case)

**Fix:**
1. Verify table schema in Supabase:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'qr_mappings';
   ```
2. Should show: `qr_code_id`, `member_id`, `event_id`, `created_at`
3. If wrong, drop and re-create table with correct SQL

### Scenario 4: RLS Policy Blocks Insert

**Console log:**
```
Supabase upsert error: errorMessage: "new row violates row-level security policy"
```

**Fix:**
```sql
-- In Supabase SQL Editor
DROP POLICY IF EXISTS "Allow all operations on qr_mappings" ON qr_mappings;

CREATE POLICY "Allow all operations on qr_mappings" ON qr_mappings
  FOR ALL USING (true) WITH CHECK (true);
```

---

## Cross-Device Test

Once console shows ✅ success:

### Setup Two Devices

**Device A (Laptop/Desktop):**
- Same as verification steps above
- Register member from surplus QR
- Note the QR code ID (e.g., "SURPLUS-1234567890-001")

**Device B (Tablet/Phone or Different Browser):**
- Open same app URL
- Make sure logged in
- Go to Security page

### Test Scan

On **Device B**:
1. Click "Scan QR Code" button
2. Scan the **same QR code** from Device A
3. Member should be found immediately
4. Status toggle should work ✅

**Result:**
- ✅ Member found = **Fix is working cross-device!**
- ❌ "Member not found" = Mapping not synced; check console logs again

---

## Diagnostics Command

Run the included diagnostic script:

```bash
node scripts/check-qr-mappings.js
```

This checks:
- ✅ Environment variables
- ✅ Migration status
- ✅ Code changes
- ✅ RLS policies
- ✅ Common issues

And tells you exactly what's configured and what's missing.

---

## Final Checklist

Before declaring success:

- [ ] Latest code pulled (`lib/storage.ts` has `persistQRMappingToSupabase`)
- [ ] `.env.local` has both Supabase env vars
- [ ] Migration SQL run in Supabase (`qr_mappings` table exists)
- [ ] Dev server restarted
- [ ] Member registered; console shows 3 logs + ✅
- [ ] Supabase shows row inserted (SELECT COUNT(*) FROM qr_mappings)
- [ ] Different device can find member when scanning QR

If all ✅ → **QR Mapping Sync is working!**

---

## Getting Help

| Issue | Resource |
|-------|----------|
| Understanding the fix | `QR_MAPPING_FIX_SUMMARY.md` |
| Detailed troubleshooting | `QR_MAPPING_TROUBLESHOOT.md` |
| Setup guide | `QR_MAPPING_QUICK_START.md` |
| Technical details | `QR_MAPPING_SYNC.md` |
| Implementation overview | `IMPLEMENTATION_COMPLETE.md` |
| Diagnostics | `node scripts/check-qr-mappings.js` |

---

## Expected Timeline

- **Migration run**: < 1 min
- **Code update**: Already done
- **Server restart**: 2-3 mins
- **Registration test**: 1 min
- **Cross-device test**: 2 mins

**Total: ~10 minutes**

Once all checks pass, QR sync will work across **unlimited devices** for the same Supabase project.
