// The link of the password reset email (MH-07). It works once and for a limited time. The product
// owner has not said for how long: one hour is our choice, kept here so it is easy to change.
// The email does not say it (emails mockup): the product owner has not decided it.
export const RESET_LINK_LIFETIME_MS = 60 * 60 * 1000;

// The page of the client where the hiker chooses the new password. `appUrl` is the address of the
// website (config.js), `token` is the id the email carries (only its hash is stored).
export const passwordResetLink = (appUrl, token) => `${appUrl.replace(/\/+$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
