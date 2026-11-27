-- Preview database migration only. Apply to isolated database before enabling generation.
CREATE TABLE IF NOT EXISTS card_motion_preview_budget (
  batch_id text PRIMARY KEY,
  limit_cents integer NOT NULL CHECK (limit_cents BETWEEN 1 AND 200),
  reserved_cents integer NOT NULL DEFAULT 0 CHECK (reserved_cents >= 0),
  CHECK (reserved_cents <= limit_cents)
);
CREATE TABLE IF NOT EXISTS card_motion_preview_jobs (
  job_id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES card_motion_preview_budget(batch_id),
  model text NOT NULL,
  reserved_cents integer NOT NULL CHECK (reserved_cents > 0),
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','submitted','completed','failed','unknown')),
  provider_request_id text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Atomic reservation. Duplicate job IDs cannot consume the budget twice.
CREATE OR REPLACE FUNCTION reserve_card_motion_preview(p_batch text,p_job text,p_model text,p_cents integer)
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  IF p_cents IS NULL OR p_cents <= 0 THEN RETURN false; END IF;
  PERFORM 1 FROM card_motion_preview_budget WHERE batch_id=p_batch FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM card_motion_preview_jobs WHERE job_id=p_job) THEN RETURN false; END IF;
  UPDATE card_motion_preview_budget SET reserved_cents=reserved_cents+p_cents
    WHERE batch_id=p_batch AND reserved_cents+p_cents<=limit_cents;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO card_motion_preview_jobs(job_id,batch_id,model,reserved_cents)
    VALUES(p_job,p_batch,p_model,p_cents);
  RETURN true;
END;
$$;
-- Never release reservations automatically on timeouts or ambiguous provider errors.
-- Reconcile actual provider billing before any manual adjustment.
-- No public endpoint or generation enabled by this migration.
