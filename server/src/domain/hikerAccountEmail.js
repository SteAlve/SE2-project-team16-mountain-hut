/**
 * The email of a hiker account made by the staff (MH-07): it tells the hiker the account exists and
 * gives the first password, which the server generated. The employee never sees it: this email is
 * the only place where it is written. The hiker must choose their own at the first login.
 *
 * A pure function: sending it is the job of the mailer.
 */
import { closing, detailRow, emailPage, escapeHtml, INK, linkButton, paragraph } from './emailLayout.js';

export const hikerAccountEmail = ({ firstName, lastName, email, password, loginUrl }) => {
  const name = `${firstName} ${lastName}`;

  return {
    to: email,
    subject: 'Your QUOTA account',
    text: [
      `Hello ${name},`,
      '',
      'The team of the hut has made a QUOTA account for you, so you can book your tables on the website.',
      '',
      `Email: ${email}`,
      `Password: ${password}`,
      '',
      'The first time you log in you will be asked to choose your own password.',
      `Log in: ${loginUrl}`,
      '',
      'If you have lost this email, use "Forgot password?" on the login page to choose a new password.',
      '',
      'See you at the hut!',
    ].join('\n'),
    html: emailPage({
      heading: 'Your account is ready',
      bodyHtml: `${paragraph(`Hello ${escapeHtml(name)}, the team of the hut has made a QUOTA account for you, so you can book your tables on the website.`)}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                ${detailRow('Email', escapeHtml(email))}
                ${detailRow('Password', `<span style="font-family:Menlo,Consolas,monospace;color:${INK};">${escapeHtml(password)}</span>`)}
              </table>${paragraph('The first time you log in you will be asked to choose your own password.')}${linkButton(escapeHtml(loginUrl), 'Log in')}${paragraph('If you have lost this email, use <b>Forgot password?</b> on the login page to choose a new password.')}${closing('See you at the hut!')}`,
    }),
  };
};
