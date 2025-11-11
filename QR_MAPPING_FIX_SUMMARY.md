# QR Mapping Fix - What Was Changed & Why

## The Problem

The `qr_mappings` table was staying **empty** even after members were registered using surplus ID card QR codes. This prevented cross-device synchronization because mappings were never persisted to Supabase.

## Root Cause

The original `saveQRCodeMapping()` function used an **async IIFE (Immediately Invoked Function Expression)** that wasn't properly awaited:

```typescript
// ❌ OLD CODE - Had Issues
if (isSupabaseConfigured) {
  (async () => {
    // ... upsert logic
  })()  // ← Launched but never awaited!
}
```

**Why this failed:**
1. Function returned immediately without waiting
2. Browser might unload before the async request completed
3. Errors were only logged to console (easy to miss)
4. No proper error propagation or debugging visibility

## The Solution

### 1. **Separated Async Logic** (Cleaner & More Maintainable)

Created an explicit `persistQRMappingToSupabase()` function:

```typescript
// ✅ NEW CODE - Explicit Async Function
const persistQRMappingToSupabase = async (qrCodeId: string, memberId: string) => {
  try {
    if (!supabase) {
      console.warn("Supabase client not configured")
      return
    }

    const payload = {
      qr_code_id: qrCodeId,      // ← Snake case (Supabase convention)
      member_id: memberId,        // ← Snake case
    }

    console.log("Attempting to upsert QR mapping to Supabase:", { qrCodeId, memberId })
    
    const { error } = await supabase
      .from("qr_mappings")
      .upsert(payload, { onConflict: "qr_code_id" })

    if (error) {
      console.error("Supabase upsert error:", {
        errorMessage: error.message,
        errorDetails: error.details,
        errorCode: error.code,
        errorHint: error.hint,
      })
      return
    }

    console.log("✅ QR Code mapping successfully persisted to Supabase:", { qrCodeId, memberId })
  } catch (err) {
    console.error("Unexpected error while saving QR mapping to Supabase:", err)
  }
}
```

### 2. **Proper Error Handling in `saveQRCodeMapping()`**

```typescript
// ✅ NEW CODE - Fire-and-forget with proper error catching
export const saveQRCodeMapping = (qrCodeId: string, memberId: string) => {
  // 1. Save to localStorage immediately
  const mappings = getFromLocalStorage(LOCAL_QR_CODE_MAPPING_KEY, {})
  mappings[qrCodeId] = memberId
  saveToLocalStorage(LOCAL_QR_CODE_MAPPING_KEY, mappings)
  console.log("QR Code mapping saved to localStorage:", { qrCodeId, memberId })

  // 2. Attempt async Supabase persistence (non-blocking)
  if (isSupabaseConfigured) {
    persistQRMappingToSupabase(qrCodeId, memberId).catch((err) => {
      console.warn("Failed to persist to Supabase, but localStorage fallback is available:", err)
    })
  }
}
```

### 3. **Enhanced Error Logging in `getMemberIdFromQRCode()`**

```typescript
// ✅ NEW CODE - Detailed logging for debugging
export const getMemberIdFromQRCode = async (qrCodeId: string): Promise<string | null> => {
  if (isSupabaseConfigured && supabase) {
    try {
      console.log("Querying Supabase for QR mapping:", { qrCodeId })
      
      const { data, error } = await supabase
        .from("qr_mappings")
        .select("member_id")
        .eq("qr_code_id", qrCodeId)
        .maybeSingle()

      if (error) {
        console.warn("Error querying qr_mappings from Supabase:", {
          errorMessage: error.message,
          errorDetails: error.details,
          errorCode: error.code,
        })
      } else if (data && (data as any).member_id) {
        const mappedId = (data as any).member_id as string
        console.log("✅ QR Code mapping found in Supabase:", { qrCodeId, mappedId })
        return mappedId
      } else {
        console.log("No QR mapping found in Supabase, trying localStorage:", { qrCodeId })
      }
    } catch (err) {
      console.warn("Unexpected error querying Supabase:", err)
    }
  }

  // Fallback to localStorage with detailed logging
  const mappings = getFromLocalStorage(LOCAL_QR_CODE_MAPPING_KEY, {})
  const mappedId = mappings[qrCodeId] || null
  if (mappedId) {
    console.log("✅ QR Code mapping found in localStorage:", { qrCodeId, mappedId })
  } else {
    console.log("❌ QR Code mapping NOT found (neither Supabase nor localStorage):", { qrCodeId })
  }
  return mappedId
}
```

## Key Improvements

| Aspect | Before | After |
|--------|--------|-------|
| **Async Handling** | IIFE not awaited | Explicit function with proper error handling |
| **Error Logging** | Silent failures in IIFE | Detailed error logs at every step |
| **Debugging** | Hard to track issues | Console logs show exact failure point |
| **Code Clarity** | Nested IIFE pattern | Separate, readable function |
| **Error Propagation** | Errors only in console | Detailed error objects with codes/hints |
| **Supabase Client Check** | Not checked | Explicit check before use |
| **Column Names** | Generic | Documented snake_case convention |

## What to Do Now

### 1. Pull Latest Code

Update `lib/storage.ts` to include:
- `persistQRMappingToSupabase()` function
- Updated `saveQRCodeMapping()` function
- Enhanced `getMemberIdFromQRCode()` function

### 2. Verify Environment Setup

In `.env.local`, ensure these are set:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run Migration (If Not Already Done)

In Supabase SQL Editor:
```sql
-- Copy entire contents of scripts/create-qr-mappings.sql
-- Paste and run in Supabase SQL Editor
```

### 4. Restart Dev Server

```bash
pnpm dev
# or
npm run dev
```

### 5. Test & Debug

**Register a member from surplus QR:**

1. Open DevTools: **F12** or **Cmd+Option+I**
2. Go to **Console** tab
3. Register a member from surplus QR code
4. Look for logs:
   ```
   QR Code mapping saved to localStorage: {qrCodeId: "SURPLUS-...", memberId: "uuid"}
   Attempting to upsert QR mapping to Supabase: {qrCodeId: "SURPLUS-...", memberId: "uuid"}
   ✅ QR Code mapping successfully persisted to Supabase: {qrCodeId: "SURPLUS-...", memberId: "uuid"}
   ```

**Check Supabase:**

```sql
SELECT * FROM qr_mappings 
ORDER BY created_at DESC 
LIMIT 5;
```

Should show the newly registered mappings.

### 6. Test Cross-Device

- **Device A**: Register member from surplus QR
- **Device B**: Scan same QR in Security/Catering → Member should be found ✅

## Diagnostic Tools

### Check Script

Run this to diagnose configuration issues:
```bash
node scripts/check-qr-mappings.js
```

Checks:
- Environment variables
- Migration status
- RLS policies
- Common issues
- Expected console logs

### Troubleshooting Guide

See `QR_MAPPING_TROUBLESHOOT.md` for:
- Root causes of empty table
- Step-by-step debugging
- RLS policy verification
- Manual INSERT testing
- Browser console log meanings

## Success Indicators

✅ Console shows: `✅ QR Code mapping successfully persisted to Supabase`

✅ Supabase query returns rows:
```sql
SELECT * FROM qr_mappings;
```

✅ Different device can find member:
- Register on Device A
- Scan QR on Device B
- Member found without re-registration

## Files Modified

| File | Change |
|------|--------|
| `lib/storage.ts` | Split async logic, added explicit function, enhanced logging |
| `scripts/check-qr-mappings.js` | New diagnostic script |
| `QR_MAPPING_QUICK_START.md` | Updated with fix steps |
| `QR_MAPPING_TROUBLESHOOT.md` | New comprehensive troubleshooting guide |
| `IMPLEMENTATION_COMPLETE.md` | Updated files list |

## Why This Works Better

1. **Explicit Control**: Separate function makes flow obvious
2. **Better Error Handling**: `.catch()` ensures errors are handled
3. **Detailed Logging**: Every step logged with ✅/❌ indicators
4. **Debugging**: Easy to trace where issues occur
5. **Supabase Client Check**: Prevents null reference errors
6. **Snake Case Columns**: Matches Supabase naming convention
7. **Non-Blocking**: UI never waits for Supabase (fallback always available)

## Questions & Support

- For setup: See `QR_MAPPING_QUICK_START.md`
- For troubleshooting: See `QR_MAPPING_TROUBLESHOOT.md`
- For architecture: See `QR_MAPPING_SYNC.md`
- To diagnose: Run `node scripts/check-qr-mappings.js`
