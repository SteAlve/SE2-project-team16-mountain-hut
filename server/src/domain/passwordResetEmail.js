/**
 * The email of the password reset (MH-07): the link where the user chooses a new password. The link
 * works once and for a limited time (domain/passwordReset.js). A pure function: sending it is the job
 * of the mailer.
 *
 * Its texts and layout are those of the emails mockup (docs/mockups/emails, email 2), which says
 * that the link works for 24 hours, and only once.
 */
import { emailPage, escapeHtml, fallbackLink, linkButton, note, paragraph } from './emailLayout.js';
import { RESET_LINK_LIFETIME_HOURS } from './passwordReset.js';

export const passwordResetEmail = ({ firstName, lastName, email, link }) => {
  const name = `${firstName} ${lastName}`;
  const validity = `The link works for ${RESET_LINK_LIFETIME_HOURS} hours, and only once.`;

  return {
    to: email,
    subject: 'Choose a new password for QUOTA',
    text: [
      `Hello ${name},`,
      '',
      'We received a request to reset the password of your QUOTA account.',
      'To choose a new one, open this link:',
      '',
      link,
      '',
      'Did not ask for it? You can ignore this email: your password stays the same.',
      validity,
    ].join('\n'),
    html: emailPage({
      heading: 'Choose a new password',
      bodyHtml: [
        paragraph(`Hello ${escapeHtml(name)}, we received a request to reset the password of your QUOTA account. Use the button to choose a new one.`),
        linkButton(escapeHtml(link), 'Choose a new password'),
        fallbackLink(escapeHtml(link)),
        note(`Did not ask for it? You can ignore this email: your password stays the same. ${validity}`),
      ].join(''),
    }),
  };
};
