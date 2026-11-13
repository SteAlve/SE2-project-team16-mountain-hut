/**
 * HOOKS (helper, no React): the email of the last password reset asked in this browser
 * (docs/mockups/login/README.md, "Password reset by email"). The link of the email carries only a
 * token, and no answer of the server gives the email: the pages show "For <email>." and write it in
 * the login only when this browser asked for the link. It is kept until the new password is saved.
 * Storage can be missing or blocked (private windows): then the pages simply do not know the email.
 */
const KEY = 'quota.passwordResetEmail';

export function rememberResetEmail(email) {
  try {
    localStorage.setItem(KEY, email);
  } catch {
    // Not kept: the pages leave the email out.
  }
}

export function rememberedResetEmail() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function forgetResetEmail() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing was kept.
  }
}
