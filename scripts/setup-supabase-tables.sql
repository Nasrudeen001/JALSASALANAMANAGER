-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  starting_date DATE NOT NULL,
  duration INTEGER NOT NULL,
  location TEXT NOT NULL,
  theme TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create regions table
CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, name)
);

-- Create jamaat table
CREATE TABLE IF NOT EXISTS jamaat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(region_id, name)
);

-- Create tajneed members table
CREATE TABLE IF NOT EXISTS tajneed_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  tanzeem TEXT NOT NULL,
  region TEXT NOT NULL,
  jamaat TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create attendance records table
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES tajneed_members(id) ON DELETE CASCADE,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, member_id)
);

-- Create tanzeem_counters table
CREATE TABLE IF NOT EXISTS tanzeem_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tanzeem TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, tanzeem)
);

-- Create security_movements table
CREATE TABLE IF NOT EXISTS security_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('In', 'Out')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create catering_records table
CREATE TABLE IF NOT EXISTS catering_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (day IN ('Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday')),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
  served_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, attendance_record_id, day, meal_type)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_regions_event_id ON regions(event_id);
CREATE INDEX IF NOT EXISTS idx_jamaat_region_id ON jamaat(region_id);
CREATE INDEX IF NOT EXISTS idx_tajneed_event_id ON tajneed_members(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_event_id ON attendance_records(event_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member_id ON attendance_records(member_id);
CREATE INDEX IF NOT EXISTS idx_tanzeem_counters_event_id ON tanzeem_counters(event_id);
CREATE INDEX IF NOT EXISTS idx_security_event_id ON security_movements(event_id);
CREATE INDEX IF NOT EXISTS idx_security_attendance_record_id ON security_movements(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_catering_event_id ON catering_records(event_id);
CREATE INDEX IF NOT EXISTS idx_catering_attendance_record_id ON catering_records(attendance_record_id);
CREATE INDEX IF NOT EXISTS idx_catering_day_meal ON catering_records(event_id, day, meal_type);

-- Enable Row Level Security (RLS)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE jamaat ENABLE ROW LEVEL SECURITY;
ALTER TABLE tajneed_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tanzeem_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE catering_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all operations for now - adjust based on your auth needs)
CREATE POLICY "Allow all operations on events" ON events
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on regions" ON regions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on jamaat" ON jamaat
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on tajneed_members" ON tajneed_members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on attendance_records" ON attendance_records
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on tanzeem_counters" ON tanzeem_counters
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on security_movements" ON security_movements
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on catering_records" ON catering_records
  FOR ALL USING (true) WITH CHECK (true);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Attendance Register', 'Security Check', 'Catering Service')),
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Enable Row Level Security for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users
CREATE POLICY "Allow all operations on users" ON users
  FOR ALL USING (true) WITH CHECK (true);
