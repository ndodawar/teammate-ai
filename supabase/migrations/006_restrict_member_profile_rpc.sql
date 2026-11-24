-- Migration: Restrict EXECUTE on update_member_profile
-- Ensure only service_role (backend) can call this function

REVOKE EXECUTE ON FUNCTION public.update_member_profile(UUID, TEXT, TEXT, TEXT, INT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_member_profile(UUID, TEXT, TEXT, TEXT, INT, JSONB) FROM authenticated;

-- service_role should already have it from migration 005, but we ensure it here
GRANT EXECUTE ON FUNCTION public.update_member_profile(UUID, TEXT, TEXT, TEXT, INT, JSONB) TO service_role;
