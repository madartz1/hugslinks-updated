-- Run once against the HUGS voting Postgres database before deployment.
CREATE TABLE IF NOT EXISTS hugs_contest_votes (
 contest_id UUID NOT NULL,
 artwork_id TEXT NOT NULL,
 voter_hash CHAR(64) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (contest_id, voter_hash)
);
CREATE INDEX IF NOT EXISTS hugs_contest_votes_score_idx ON hugs_contest_votes(contest_id,artwork_id);
CREATE TABLE IF NOT EXISTS hugs_art_ratings (
 artwork_id TEXT NOT NULL,
 voter_hash CHAR(64) NOT NULL,
 rating SMALLINT NOT NULL CHECK(rating BETWEEN 1 AND 5),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(artwork_id,voter_hash)
);
CREATE INDEX IF NOT EXISTS hugs_art_ratings_score_idx ON hugs_art_ratings(artwork_id);
