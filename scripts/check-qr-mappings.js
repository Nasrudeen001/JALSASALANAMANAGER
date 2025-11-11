#!/usr/bin/env node

/**
 * QR Mapping Diagnostics Script
 * 
 * This script helps diagnose why QR mappings are not being persisted to Supabase.
 * 
 * Usage:
 *   node scripts/check-qr-mappings.js
 * 
 * Prerequisites:
 *   - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set in .env.local
 *   - Node.js 16+
 *   - pnpm/npm packages installed (@supabase/supabase-js)
 */

const fs = require('fs');
const path = require('path');

// Read .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

// Parse environment variables
const env = {};
envContent.split('\n').forEach(line => {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...rest] = line.split('=');
    if (key) {
      env[key.trim()] = rest.join('=').trim();
    }
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('\n🔍 QR Mapping Diagnostics\n');
console.log('=' .repeat(60));

// Check 1: Environment variables
console.log('\n✅ Check 1: Environment Variables');
console.log('-'.repeat(60));
if (supabaseUrl) {
  console.log('  ✓ NEXT_PUBLIC_SUPABASE_URL is set');
  console.log(`    URL: ${supabaseUrl}`);
} else {
  console.log('  ✗ NEXT_PUBLIC_SUPABASE_URL is NOT set');
}

if (supabaseAnonKey) {
  console.log('  ✓ NEXT_PUBLIC_SUPABASE_ANON_KEY is set');
  console.log(`    Key: ${supabaseAnonKey.substring(0, 20)}...`);
} else {
  console.log('  ✗ NEXT_PUBLIC_SUPABASE_ANON_KEY is NOT set');
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('\n❌ ERROR: Supabase environment variables not configured!');
  console.log('   Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

// Check 2: qr_mappings table structure
console.log('\n✅ Check 2: qr_mappings Table Structure');
console.log('-'.repeat(60));
console.log('Expected columns:');
console.log('  - qr_code_id (TEXT, PRIMARY KEY)');
console.log('  - member_id (UUID NOT NULL)');
console.log('  - event_id (UUID, optional)');
console.log('  - created_at (TIMESTAMP WITH TIME ZONE)');
console.log('\n⚠️  To verify, run in Supabase SQL Editor:');
console.log('  SELECT column_name, data_type FROM information_schema.columns');
console.log('  WHERE table_name = \'qr_mappings\'');

// Check 3: Migration applied
console.log('\n✅ Check 3: Migration Status');
console.log('-'.repeat(60));
const migrationPath = path.join(process.cwd(), 'scripts', 'create-qr-mappings.sql');
if (fs.existsSync(migrationPath)) {
  console.log('  ✓ Migration file exists: scripts/create-qr-mappings.sql');
  console.log('\n⚠️  To apply migration, run in Supabase SQL Editor:');
  const migration = fs.readFileSync(migrationPath, 'utf-8');
  console.log('  ' + migration.split('\n').slice(0, 5).join('\n  '));
  console.log('  ... (see scripts/create-qr-mappings.sql for full SQL)');
} else {
  console.log('  ✗ Migration file NOT found: scripts/create-qr-mappings.sql');
}

// Check 4: Code changes
console.log('\n✅ Check 4: Code Changes');
console.log('-'.repeat(60));
const storagePath = path.join(process.cwd(), 'lib', 'storage.ts');
if (fs.existsSync(storagePath)) {
  const storageContent = fs.readFileSync(storagePath, 'utf-8');
  
  if (storageContent.includes('persistQRMappingToSupabase')) {
    console.log('  ✓ persistQRMappingToSupabase function found');
  } else {
    console.log('  ✗ persistQRMappingToSupabase function NOT found');
  }
  
  if (storageContent.includes('getMemberIdFromQRCode')) {
    console.log('  ✓ getMemberIdFromQRCode function found');
  } else {
    console.log('  ✗ getMemberIdFromQRCode function NOT found');
  }
  
  if (storageContent.includes('saveQRCodeMapping')) {
    console.log('  ✓ saveQRCodeMapping function found');
  } else {
    console.log('  ✗ saveQRCodeMapping function NOT found');
  }
} else {
  console.log('  ✗ lib/storage.ts NOT found');
}

// Check 5: Browser console logs
console.log('\n✅ Check 5: What to Look For in Browser Console');
console.log('-'.repeat(60));
console.log('When registering a member from surplus QR:');
console.log('  1. Look for: "QR Code mapping saved to localStorage"');
console.log('  2. Look for: "Attempting to upsert QR mapping to Supabase"');
console.log('  3. Look for: "✅ QR Code mapping successfully persisted to Supabase"');
console.log('     OR error logs explaining why upsert failed');
console.log('\nWhen scanning QR in Security/Catering:');
console.log('  1. Look for: "Querying Supabase for QR mapping"');
console.log('  2. Look for: "✅ QR Code mapping found in Supabase"');
console.log('     OR "No QR mapping found in Supabase, trying localStorage"');

// Check 6: Common issues
console.log('\n✅ Check 6: Common Issues & Solutions');
console.log('-'.repeat(60));
console.log('Issue: "Table qr_mappings does not exist"');
console.log('  → Solution: Run the migration in Supabase SQL Editor');
console.log('              (scripts/create-qr-mappings.sql)');
console.log('');
console.log('Issue: Mappings saved to localStorage but not Supabase');
console.log('  → Solution: Check browser console for upsert errors');
console.log('              Verify Supabase credentials in .env.local');
console.log('              Check Supabase RLS policies (should allow insert/update)');
console.log('');
console.log('Issue: Supabase client undefined');
console.log('  → Solution: Verify NEXT_PUBLIC_SUPABASE_URL is correct');
console.log('              Verify NEXT_PUBLIC_SUPABASE_ANON_KEY is correct');
console.log('');
console.log('Issue: CORS errors or network timeouts');
console.log('  → Solution: Check Supabase project dashboard for service status');
console.log('              Verify internet connection');
console.log('              Check browser network tab for failed requests');

// Check 7: RLS Policy
console.log('\n✅ Check 7: Row Level Security (RLS) Policy');
console.log('-'.repeat(60));
console.log('RLS must allow insert/update on qr_mappings table');
console.log('Run in Supabase SQL Editor to verify:');
console.log('  SELECT * FROM pg_policies WHERE tablename = \'qr_mappings\';');
console.log('');
console.log('Expected policy (permissive):');
console.log('  CREATE POLICY "Allow all operations on qr_mappings" ON qr_mappings');
console.log('    FOR ALL USING (true) WITH CHECK (true);');

// Final summary
console.log('\n' + '='.repeat(60));
console.log('\n📋 Summary & Next Steps:');
console.log('-'.repeat(60));
console.log('1. ✅ Verify environment variables are set');
console.log('2. ✅ Run migration: scripts/create-qr-mappings.sql in Supabase');
console.log('3. ✅ Verify RLS policy allows insert/update');
console.log('4. ✅ Open browser DevTools → Console');
console.log('5. ✅ Register a member from surplus QR in Attendance page');
console.log('6. ✅ Check console for upsert logs (✅ or errors)');
console.log('7. ✅ In Supabase, verify row was inserted: SELECT * FROM qr_mappings');
console.log('8. ✅ Test scanning in Security/Catering on different device');
console.log('\nFor detailed troubleshooting, see: QR_MAPPING_QUICK_START.md\n');
