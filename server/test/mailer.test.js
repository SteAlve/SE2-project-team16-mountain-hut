// The mailer against a real SMTP server (test/helpers/smtpInbox.js), through nodemailer.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeMailer } from '../src/mailer.js';
import { startSmtpInbox } from './helpers/smtpInbox.js';

const FROM = 'QUOTA <no-reply@quota.example>';
const email = {
  to: 'mara.rossi@example.com',
  subject: 'Your table is booked (QUOTA-00001)',
  text: 'Hello Mara Rossi,',
  html: '<p>Hello Mara Rossi,</p>',
};

let inbox;
let inboxWithLogin;

beforeAll(async () => {
  inbox = await startSmtpInbox();
  inboxWithLogin = await startSmtpInbox({ user: 'quota', password: 'smtp-test-password' });
});
afterEach(() => {
  inbox.clear();
  inboxWithLogin.clear();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await inbox.stop();
  await inboxWithLogin.stop();
});

describe('mailer', () => {
  it('sends the email to the SMTP server, with the sender and both versions', async () => {
    const mailer = makeMailer({ host: '127.0.0.1', port: inbox.port, from: FROM });

    await mailer.send(email);

    expect(inbox.emails).toEqual([{
      envelope: { from: 'no-reply@quota.example', to: ['mara.rossi@example.com'] },
      from: { name: 'QUOTA', address: 'no-reply@quota.example' },
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    }]);
  });

  it('logs in with SMTP_USER and SMTP_PASSWORD when they are set', async () => {
    const mailer = makeMailer({
      host: '127.0.0.1', port: inboxWithLogin.port, user: 'quota', password: 'smtp-test-password', from: FROM,
    });

    await mailer.send(email);

    expect(inboxWithLogin.logins).toEqual(['quota']);
    expect(inboxWithLogin.emails).toHaveLength(1);
  });

  it('rejects when the login is wrong, and nothing is sent', async () => {
    const mailer = makeMailer({
      host: '127.0.0.1', port: inboxWithLogin.port, user: 'quota', password: 'wrong', from: FROM,
    });

    await expect(mailer.send(email)).rejects.toMatchObject({ responseCode: 535 });
    expect(inboxWithLogin.emails).toEqual([]);
  });

  it('rejects when the server refuses the email', async () => {
    inbox.refuse = true;
    const mailer = makeMailer({ host: '127.0.0.1', port: inbox.port, from: FROM });

    await expect(mailer.send(email)).rejects.toMatchObject({ responseCode: 550 });
    expect(inbox.emails).toEqual([]);
  });

  it('rejects when no server answers on that port', async () => {
    const closed = await startSmtpInbox();
    await closed.stop();
    const mailer = makeMailer({ host: '127.0.0.1', port: closed.port, from: FROM });

    await expect(mailer.send(email)).rejects.toMatchObject({ code: 'ESOCKET' });
  });

  it('without SMTP_HOST only writes the email to the log', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const mailer = makeMailer({ host: undefined, port: 587, from: FROM });

    await mailer.send(email);

    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain('To: mara.rossi@example.com');
    expect(log.mock.calls[0][0]).toContain(`Subject: ${email.subject}`);
  });
});
