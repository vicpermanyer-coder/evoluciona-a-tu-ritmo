-- 1) Goal catalogue: Fitness, Healthy Eating, Social Confidence, Style, Discipline, Emotional Wellbeing.
--    The old "habitos" goal becomes "disciplina".
ALTER TABLE public.goals DROP CONSTRAINT goals_goal_check;
UPDATE public.goals SET goal = 'disciplina' WHERE goal = 'habitos';
ALTER TABLE public.goals ADD CONSTRAINT goals_goal_check
  CHECK (goal IN ('fitness','nutricion','confianza','estilo','disciplina','bienestar'));

-- 2) Daily challenges are generated only on the server from the curated library,
--    so users cannot insert their own rows (arbitrary XP) or delete completed ones.
DROP POLICY IF EXISTS "own challenges insert" ON public.daily_challenges;
DROP POLICY IF EXISTS "own challenges delete" ON public.daily_challenges;
REVOKE INSERT, DELETE ON public.daily_challenges FROM authenticated;

-- Inserts a user's daily set once; a lock per user/day makes concurrent calls safe
-- and a day that already has challenges is never changed.
CREATE OR REPLACE FUNCTION public.insert_daily_challenges(p_user_id uuid, p_date date, p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_date::text, 0));
  IF EXISTS (SELECT 1 FROM public.daily_challenges WHERE user_id = p_user_id AND challenge_date = p_date) THEN
    RETURN 0;
  END IF;
  INSERT INTO public.daily_challenges (user_id, challenge_date, template_key, title, description, category, xp)
  SELECT p_user_id, p_date, r.template_key, r.title, r.description, r.category, r.xp
  FROM jsonb_to_recordset(p_rows) AS r(template_key text, title text, description text, category text, xp integer)
  ON CONFLICT (user_id, challenge_date, template_key) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.insert_daily_challenges(uuid, date, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_daily_challenges(uuid, date, jsonb) TO service_role;

-- 3) Save name, intensity and goals in one transaction (runs as the caller, so RLS applies).
CREATE OR REPLACE FUNCTION public.save_preferences(p_display_name text, p_intensity text, p_goals text[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); clean_name text := btrim(coalesce(p_display_name, ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sesión no válida'; END IF;
  IF char_length(clean_name) < 2 OR char_length(clean_name) > 40 THEN
    RAISE EXCEPTION 'El nombre debe tener entre 2 y 40 caracteres';
  END IF;
  IF p_goals IS NULL OR cardinality(p_goals) = 0 THEN
    RAISE EXCEPTION 'Elige al menos un objetivo';
  END IF;

  INSERT INTO public.profiles (id, display_name, intensity, onboarded, updated_at)
  VALUES (uid, clean_name, p_intensity, true, now())
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name, intensity = EXCLUDED.intensity, onboarded = true, updated_at = now();

  DELETE FROM public.goals WHERE user_id = uid AND NOT (goal = ANY (p_goals));
  INSERT INTO public.goals (user_id, goal)
  SELECT DISTINCT uid, g FROM unnest(p_goals) AS g
  ON CONFLICT (user_id, goal) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.save_preferences(text, text, text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_preferences(text, text, text[]) TO authenticated;