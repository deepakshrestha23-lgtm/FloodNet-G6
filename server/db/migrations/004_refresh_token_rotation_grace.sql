-- Refresh tokens are rotated on every use. When several requests refresh at the
-- same moment (parallel API calls after the access token expires, a second
-- browser tab, or a fast double navigation) the first rotates the stored hash
-- and the others no longer match, which logged the user out.
--
-- Keeping the immediately previous hash for a short grace window lets those
-- concurrent requests succeed while still rotating the token on every use.
ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS previous_token_hash VARCHAR(255),
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS auth_sessions_previous_token_idx
  ON auth_sessions(previous_token_hash)
  WHERE previous_token_hash IS NOT NULL;
