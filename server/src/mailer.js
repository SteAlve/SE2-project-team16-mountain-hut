/**
 * MAILER: the only place that sends emails. app.js builds it with the SMTP settings of config.js
 * and hands it to the use cases, so a test can pass a fake one.
 *
 * Without SMTP_HOST nothing is sent: the email is only written to the log, so development needs no
 * email service. send() rejects when the email service refuses or does not answer; the timeouts
 * keep a hiker from waiting for a service that is down.
 */
import nodemailer from 'nodemailer';

const TIMEOUT_MS = 5000;

const makeLogMailer = () => ({
  send: async ({ to, subject, text }) => {
    console.log(`SMTP_HOST is not set, so this email is only logged.\nTo: ${to}\nSubject: ${subject}\n\n${text}`);
  },
});

export const makeMailer = ({ host, port, user, password, from }) => {
  if (!host) return makeLogMailer();

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // the SMTP port that is encrypted from the start
    auth: user ? { user, pass: password } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });

  return {
    send: ({ to, subject, text, html }) => transport.sendMail({ from, to, subject, text, html }),
  };
};
