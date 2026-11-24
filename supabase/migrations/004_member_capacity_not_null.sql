-- Migration: Make members.capacity NOT NULL
-- PRD Section 5.1 (FR-03)

ALTER TABLE public.members
ALTER COLUMN capacity SET NOT NULL;
