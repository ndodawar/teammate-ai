-- Migration: FR-03 Member Profile Enhancements
-- PRD Section 4.2 & 5.1 (FR-03)

-- 1. Add note and capacity constraint to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS note TEXT CHECK (note IS NULL OR length(note) <= 300);

-- Ensure capacity > 0 for new/updated rows. Existing rows with default 40 are unaffected.
ALTER TABLE members ADD CONSTRAINT members_capacity_positive CHECK (capacity > 0);

-- 2. Create member_skills relational table
CREATE TABLE IF NOT EXISTS member_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE NOT NULL,
    skill_name TEXT NOT NULL,
    skill_level INT CHECK (skill_level BETWEEN 1 AND 5) NOT NULL,
    interest_level INT CHECK (interest_level BETWEEN 1 AND 5) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS on member_skills
ALTER TABLE member_skills ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy for member_skills following existing pattern (001_initial_schema.sql)
CREATE POLICY "Allow all server access member_skills" ON member_skills FOR ALL USING (true) WITH CHECK (true);
