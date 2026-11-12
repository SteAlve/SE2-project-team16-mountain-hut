-- MH-07: hikers entered by the staff, and the password reset by email.

-- A temporary hiker is a name and, at most, a phone number: no email, no password, no login. The
-- employee makes one with the quick entry. A hiker made with an email is a regular account: its
-- password is generated, the employee tells it, and must_change_password makes the hiker choose
-- their own at the first login.
ALTER TABLE app_user
    ADD COLUMN temporary BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

-- The unique index and the lowercase check of the email stay: a NULL passes the check and the
-- index lets any number of NULLs in.
ALTER TABLE app_user
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN password_hash DROP NOT NULL;

-- The two kinds of account cannot be mixed: a temporary hiker has no way to log in, a regular
-- user always has an email and a password. Only a hiker can be temporary.
ALTER TABLE app_user
    ADD CONSTRAINT app_user_kind CHECK (
        (temporary AND role = 'HIKER' AND email IS NULL AND password_hash IS NULL AND NOT must_change_password)
        OR (NOT temporary AND email IS NOT NULL AND password_hash IS NOT NULL)
    );

-- The links of the password reset emails. Only the hash of the token is stored, as for the
-- sessions: the token itself exists only in the email. A link works once (used_at) and for a
-- limited time (expires_at), and a new request replaces the one that was waiting.
CREATE TABLE password_reset (
    token_hash TEXT        PRIMARY KEY,
    user_id    INTEGER     NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one link waiting to be used for each user.
CREATE UNIQUE INDEX password_reset_pending_idx ON password_reset (user_id) WHERE used_at IS NULL;

CREATE INDEX password_reset_expires_at_idx ON password_reset (expires_at);
