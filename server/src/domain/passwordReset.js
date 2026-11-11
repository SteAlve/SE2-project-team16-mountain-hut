// The link of the password reset email (MH-07). It works once and for a limited time.
// The product owner says 24 hours (issue #44 of the course repository, after the NIST guidelines). The
// email says it too, from this same number, so it cannot disagree with the server.
export const RESET_LINK_LIFETIME_HOURS = 24;
export const RESET_LINK_LIFETIME_MS = RESET_LINK_LIFETIME_HOURS * 60 * 60 * 1000;

// The page of the client where the hiker chooses the new password. `appUrl` is the address of the
// website (config.js), `token` is the id the email carries (only its hash is stored).
export const passwordResetLink = (appUrl, token) => `${appUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
