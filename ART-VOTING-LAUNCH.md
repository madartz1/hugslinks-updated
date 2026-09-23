# HUGS Art Voting — Launch Checklist

The gallery is at /art-voting.html. Netlify remains locked until the site owner approves deployment.

## Required Netlify environment variables
- HUGS_VOTER_SESSION_SECRET: generate a new random secret of at least 32 bytes; never commit it.
- RESEND_API_KEY: valid server-side Resend API key.
- HUGS_VOTER_FROM_EMAIL: verified sender address at the configured Resend domain, e.g. a dedicated HUGSLinks sign-in mailbox.

Deploy after setting these variables. Verify sender domain with Resend. Never paste keys in GitHub or the public HTML.

## Smoke tests
1. Publish a test artwork in private Admin > Art Gallery.
2. Open /art-voting.html in a private browser window. Confirm published artwork and initial zero score.
3. Request a six-digit code; check receipt, wrong-code rejection, five-attempt limit, and ten-minute expiry.
4. Verify the code and submit one rating. Refresh; confirm vote count and average.
5. Try voting again with the same email; expect rejection.
6. Sign out; confirm voting requires sign-in.
7. Sign in with another test email and vote; confirm the new score.
8. Confirm unpublished artwork does not appear.
9. Confirm uploaded artwork displays correctly.

## Important limitations
The current email-code login is a standalone voting account. Existing HUGS members are not automatically linked until a real shared member identity provider is configured. Do not advertise unified member login yet.
Votes are stored under one deterministic key per verified email per artwork, and displayed scores are derived from stored votes rather than a mutable counter. This avoids lost counter updates, but Netlify Blobs alone does not provide an atomic create-if-absent guarantee. For a prize competition or high-volume public vote, migrate vote writes to a transactional database with a UNIQUE(artwork_id, member_id) constraint before launch.
Email-code delivery and production sign-in cannot be tested while Netlify is locked.

## Transactional voting configuration (required)
1. Provision a private Neon Postgres database (or compatible Neon serverless connection).
2. Run database/art-voting.sql once against that database.
3. Set HUGS_VOTING_DATABASE_URL in Netlify environment variables. Never commit or send its value in chat.
4. Set HUGS_VOTER_SESSION_SECRET (random secret at least 32 bytes), RESEND_API_KEY, and HUGS_VOTER_FROM_EMAIL (verified sender).
5. Unlock Netlify only when ready for the planned single deployment, then test the full login, one-vote constraint, entry cap, closing and winner publishing flows.

Competition and regular ratings now use Postgres INSERT ... ON CONFLICT DO NOTHING, backed by unique primary keys. This prevents simultaneous duplicate votes. No database or environment variables have been provisioned automatically; production testing is still pending.
