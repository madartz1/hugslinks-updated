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
