-- HL Studio AI credits v1. Run manually against a dedicated PostgreSQL database.
-- Independent of HUGS Original 333 membership and HUGS Cards purchases.
CREATE TABLE IF NOT EXISTS hl_studio_subscriptions (
 id BIGSERIAL PRIMARY KEY,
 user_id TEXT NOT NULL,
 stripe_customer_id TEXT NOT NULL,
 stripe_subscription_id TEXT NOT NULL UNIQUE,
 plan TEXT NOT NULL CHECK (plan IN ('starter','growth','pro')),
 status TEXT NOT NULL,
 current_period_start TIMESTAMPTZ,
 current_period_end TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hl_studio_sub_user ON hl_studio_subscriptions(user_id);
CREATE TABLE IF NOT EXISTS hl_studio_periods (
 id BIGSERIAL PRIMARY KEY,
 user_id TEXT NOT NULL,
 subscription_id TEXT NOT NULL REFERENCES hl_studio_subscriptions(stripe_subscription_id),
 period_start TIMESTAMPTZ NOT NULL,
 period_end TIMESTAMPTZ NOT NULL,
 allowance INTEGER NOT NULL CHECK (allowance >= 0),
 available INTEGER NOT NULL CHECK (available >= 0),
 reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
 spent INTEGER NOT NULL DEFAULT 0 CHECK (spent >= 0),
 UNIQUE(subscription_id,period_start),
 CHECK(available + reserved + spent = allowance)
);
CREATE INDEX IF NOT EXISTS hl_studio_period_user ON hl_studio_periods(user_id,period_end DESC);
CREATE TABLE IF NOT EXISTS hl_studio_generations (
 id BIGSERIAL PRIMARY KEY,
 user_id TEXT NOT NULL,
 period_id BIGINT NOT NULL REFERENCES hl_studio_periods(id),
 request_key TEXT NOT NULL,
 action TEXT NOT NULL CHECK (action IN ('text','standard_image','premium_image','card_assembly','image_revision')),
 credits INTEGER NOT NULL CHECK (credits > 0),
 status TEXT NOT NULL CHECK(status IN ('reserved','completed','failed')),
 output_ref TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(user_id,request_key)
);
CREATE INDEX IF NOT EXISTS hl_studio_gen_user ON hl_studio_generations(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS hl_studio_stripe_events (
 stripe_event_id TEXT PRIMARY KEY,
 processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Atomic credit reservations. Advisory lock serializes identical request keys;
-- row update serializes spending across different requests on a shared period.
CREATE OR REPLACE FUNCTION hl_studio_reserve(p_user TEXT,p_key TEXT,p_action TEXT,p_cost INTEGER)
RETURNS TABLE(job_id BIGINT, job_status TEXT, charged INTEGER) LANGUAGE plpgsql AS $$
DECLARE existing hl_studio_generations%ROWTYPE; chosen_id BIGINT;
BEGIN
 IF p_user IS NULL OR p_key IS NULL OR p_cost<=0 THEN RAISE EXCEPTION 'Bad reservation'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user || ':' || p_key,0));
 SELECT * INTO existing FROM hl_studio_generations WHERE user_id=p_user AND request_key=p_key;
 IF FOUND THEN
   IF existing.action<>p_action OR existing.credits<>p_cost THEN RAISE EXCEPTION 'Idempotency request conflict'; END IF;
   RETURN QUERY SELECT existing.id,existing.status,existing.credits; RETURN;
 END IF;
 UPDATE hl_studio_periods p SET available=p.available-p_cost,reserved=p.reserved+p_cost
 FROM hl_studio_subscriptions s
 WHERE p.subscription_id=s.stripe_subscription_id AND p.user_id=p_user AND s.user_id=p_user
   AND s.status='active' AND p.period_start<=NOW() AND p.period_end>NOW()
   AND p.available>=p_cost
   AND p.id=(SELECT p2.id FROM hl_studio_periods p2 JOIN hl_studio_subscriptions s2 ON s2.stripe_subscription_id=p2.subscription_id WHERE p2.user_id=p_user AND s2.user_id=p_user AND s2.status='active' AND p2.period_start<=NOW() AND p2.period_end>NOW() ORDER BY p2.period_end DESC LIMIT 1)
 RETURNING p.id INTO chosen_id;
 IF chosen_id IS NULL THEN RETURN; END IF;
 INSERT INTO hl_studio_generations(user_id,period_id,request_key,action,credits,status)
 VALUES(p_user,chosen_id,p_key,p_action,p_cost,'reserved')
 RETURNING id INTO chosen_id;
 RETURN QUERY SELECT chosen_id,'reserved'::TEXT,p_cost;
END $$;

CREATE OR REPLACE FUNCTION hl_studio_finish(p_user TEXT,p_key TEXT,p_success BOOLEAN,p_output TEXT)
RETURNS TABLE(job_id BIGINT,job_status TEXT) LANGUAGE plpgsql AS $$
DECLARE j hl_studio_generations%ROWTYPE;
BEGIN
 SELECT * INTO j FROM hl_studio_generations WHERE user_id=p_user AND request_key=p_key FOR UPDATE;
 IF NOT FOUND THEN RETURN; END IF;
 IF j.status<>'reserved' THEN RETURN QUERY SELECT j.id,j.status; RETURN; END IF;
 UPDATE hl_studio_periods SET reserved=reserved-j.credits,
    spent=spent+CASE WHEN p_success THEN j.credits ELSE 0 END,
    available=available+CASE WHEN p_success THEN 0 ELSE j.credits END
 WHERE id=j.period_id;
 UPDATE hl_studio_generations SET status=CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
 output_ref=CASE WHEN p_success THEN p_output ELSE NULL END,updated_at=NOW()
 WHERE id=j.id;
 RETURN QUERY SELECT j.id, CASE WHEN p_success THEN 'completed' ELSE 'failed' END::TEXT;
END $$;

-- Verified email logins; never store plaintext login tokens.
CREATE TABLE IF NOT EXISTS hl_studio_login_codes (
 email TEXT PRIMARY KEY,
 token_digest TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK(attempts>=0)
);
