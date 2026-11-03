-- Users (hikers, employees, wardens) and their login sessions.

CREATE TABLE app_user (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  first_name    TEXT        NOT NULL,
  last_name     TEXT        NOT NULL,
  -- stored lowercase, so the unique index also forbids the same email in another letter case
  email         TEXT        NOT NULL UNIQUE CHECK (email = lower(email)),
  phone         TEXT,
  role          TEXT        NOT NULL CHECK (role IN ('HIKER', 'EMPLOYEE', 'WARDEN')),
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only the hash of the session id is stored: the id itself exists only in the cookie.
CREATE TABLE session (
  token_hash TEXT        PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX session_user_id_idx ON session (user_id);
CREATE INDEX session_expires_at_idx ON session (expires_at);
