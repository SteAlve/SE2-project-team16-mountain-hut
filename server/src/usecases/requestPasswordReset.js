/**
 * Use case: "Forgot password?" (MH-07). If the email has an account, the server stores a new link
 * (the one that was waiting stops working) and sends it by email. Only the hash of the token is
 * stored: the token itself is only in the email. The link works once and for a limited time
 * (domain/passwordReset.js).
 *
 * It answers the same whether the email has an account or not, so nobody can find out which emails
 * are registered. For the same reason the email is not waited for: an email service that is slow or
 * down would make the answer for an existing account slower than the other. A failure of the email
 * is only written to the log.
 *
 * A temporary hiker has no email, so it cannot ask. The email arrives already in lower case (DTO).
 */
import { passwordResetEmail } from '../domain/passwordResetEmail.js';
import { passwordResetLink, RESET_LINK_LIFETIME_MS } from '../domain/passwordReset.js';

export const makeRequestPasswordReset = ({ users, passwordResets, tokens, clock, mailer, appUrl }) =>
  async ({ email }) => {
    const found = await users.findByEmail(email);
    if (found === null) return;

    const token = tokens.generate();
    await passwordResets.removeExpired(clock.now());
    await passwordResets.insert({
      userId: found.id,
      tokenHash: token.hash,
      expiresAt: clock.after(RESET_LINK_LIFETIME_MS),
    });

    // The async function runs send() now and turns an error thrown at once into a rejection.
    (async () => mailer.send(passwordResetEmail({
      firstName: found.firstName,
      lastName: found.lastName,
      email: found.email,
      link: passwordResetLink(appUrl, token.id),
    })))().catch((error) => {
      console.error(`The password reset email for user ${found.id} was not sent:`, error);
    });
  };
