-- Migration: Atomic Member Profile Update RPC with Strict Integer Validation
-- PRD Section 5.1 (FR-03)

CREATE OR REPLACE FUNCTION public.update_member_profile(
    p_member_id UUID,
    p_project_code TEXT,
    p_name TEXT,
    p_note TEXT,
    p_capacity INT,
    p_skills JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_project_id UUID;
    v_updated_member RECORD;
    v_skill JSONB;
    v_skill_name TEXT;
    v_skill_level_raw JSONB;
    v_interest_level_raw JSONB;
    v_result JSONB;
BEGIN
    -- 1. Strict Input Validations (Before any DB modification)
    
    -- Validate p_name
    IF p_name IS NULL OR trim(p_name) = '' THEN
        RAISE EXCEPTION 'Nama anggota wajib diisi.';
    END IF;

    -- Validate p_capacity
    IF p_capacity IS NULL OR p_capacity <= 0 THEN
        RAISE EXCEPTION 'Kapasitas waktu harus lebih besar dari 0.';
    END IF;

    -- Validate p_skills is a non-null JSON array
    IF p_skills IS NULL OR jsonb_typeof(p_skills) <> 'array' THEN
        RAISE EXCEPTION 'Daftar keterampilan harus berupa array JSON yang valid.';
    END IF;

    -- Validate each skill item in the array before any write operation
    FOR v_skill IN SELECT * FROM jsonb_array_elements(p_skills)
    LOOP
        IF jsonb_typeof(v_skill) <> 'object' THEN
            RAISE EXCEPTION 'Setiap item keterampilan harus berupa objek JSON.';
        END IF;

        -- Validate skill_name
        v_skill_name := trim(v_skill->>'skill_name');
        IF v_skill_name IS NULL OR v_skill_name = '' THEN
            RAISE EXCEPTION 'Nama keterampilan tidak boleh kosong.';
        END IF;

        -- Validate skill_level (Strict JSON Number, Integer, Range 1-5)
        v_skill_level_raw := v_skill->'skill_level';
        IF jsonb_typeof(v_skill_level_raw) <> 'number' THEN
            RAISE EXCEPTION 'Tingkat keterampilan harus berupa angka.';
        END IF;
        -- Integer check: floor(val) = val
        IF (v_skill_level_raw::text)::numeric <> floor((v_skill_level_raw::text)::numeric) THEN
            RAISE EXCEPTION 'Tingkat keterampilan harus berupa bilangan bulat.';
        END IF;
        IF v_skill_level_raw::int < 1 OR v_skill_level_raw::int > 5 THEN
            RAISE EXCEPTION 'Tingkat keterampilan harus berada di antara 1 sampai 5.';
        END IF;

        -- Validate interest_level (Strict JSON Number, Integer, Range 1-5)
        v_interest_level_raw := v_skill->'interest_level';
        IF jsonb_typeof(v_interest_level_raw) <> 'number' THEN
            RAISE EXCEPTION 'Tingkat minat harus berupa angka.';
        END IF;
        -- Integer check: floor(val) = val
        IF (v_interest_level_raw::text)::numeric <> floor((v_interest_level_raw::text)::numeric) THEN
            RAISE EXCEPTION 'Tingkat minat harus berupa bilangan bulat.';
        END IF;
        IF v_interest_level_raw::int < 1 OR v_interest_level_raw::int > 5 THEN
            RAISE EXCEPTION 'Tingkat minat harus berada di antara 1 sampai 5.';
        END IF;
    END LOOP;

    -- 2. Verify project code exists and get project id
    SELECT id INTO v_project_id
    FROM public.projects
    WHERE code = p_project_code;

    IF v_project_id IS NULL THEN
        RAISE EXCEPTION 'Proyek tidak ditemukan.';
    END IF;

    -- 3. Verify member exists and belongs to this project
    IF NOT EXISTS (
        SELECT 1 FROM public.members
        WHERE id = p_member_id AND project_id = v_project_id
    ) THEN
        RAISE EXCEPTION 'Anggota tidak ditemukan dalam proyek ini.';
    END IF;

    -- 4. Update member basic fields
    UPDATE public.members
    SET 
        name = trim(p_name),
        note = CASE WHEN p_note = '' OR p_note IS NULL THEN NULL ELSE p_note END,
        capacity = p_capacity
    WHERE id = p_member_id
    RETURNING id, name, capacity, note INTO v_updated_member;

    -- 5. Delete existing member skills (full replacement)
    DELETE FROM public.member_skills
    WHERE member_id = p_member_id;

    -- 6. Insert new verified member skills
    IF jsonb_array_length(p_skills) > 0 THEN
        FOR v_skill IN SELECT * FROM jsonb_array_elements(p_skills)
        LOOP
            INSERT INTO public.member_skills (
                member_id,
                skill_name,
                skill_level,
                interest_level
            ) VALUES (
                p_member_id,
                trim(v_skill->>'skill_name'),
                (v_skill->>'skill_level')::INT,
                (v_skill->>'interest_level')::INT
            );
        END LOOP;
    END IF;

    -- 7. Construct and return result JSON
    SELECT jsonb_build_object(
        'id', v_updated_member.id,
        'name', v_updated_member.name,
        'capacity', v_updated_member.capacity,
        'note', v_updated_member.note,
        'skills', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', s.id,
                        'skill_name', s.skill_name,
                        'skill_level', s.skill_level,
                        'interest_level', s.interest_level
                    )
                )
                FROM public.member_skills s
                WHERE s.member_id = p_member_id
            ),
            '[]'::jsonb
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- 8. Permissions
-- Revoke from public, grant to service_role as used by the server client
REVOKE EXECUTE ON FUNCTION public.update_member_profile(UUID, TEXT, TEXT, TEXT, INT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_member_profile(UUID, TEXT, TEXT, TEXT, INT, JSONB) TO service_role;
