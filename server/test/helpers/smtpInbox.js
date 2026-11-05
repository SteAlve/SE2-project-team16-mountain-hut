// A real email service for the tests: an SMTP server on this computer that keeps every email it
// receives, read back with the sender, the receiver and both versions (text and HTML).
// refuse = true makes it answer like a service that does not accept the email.
import { simpleParser } from 'mailparser';
import { SMTPServer } from 'smtp-server';

export async function startSmtpInbox({ user, password } = {}) {
  const inbox = { emails: [], refuse: false, logins: [] };

  const server = new SMTPServer({
    disabledCommands: user ? ['STARTTLS'] : ['STARTTLS', 'AUTH'],
    allowInsecureAuth: true, // plain connection: the server is on this computer
    authOptional: !user,
    logger: false,
    onAuth(auth, _session, callback) {
      inbox.logins.push(auth.username);
      if (auth.username === user && auth.password === password) return callback(null, { user });
      return callback(Object.assign(new Error('Invalid login'), { responseCode: 535 }));
    },
    onRcptTo(_address, _session, callback) {
      if (inbox.refuse) return callback(Object.assign(new Error('Mailbox unavailable'), { responseCode: 550 }));
      return callback();
    },
    async onData(stream, session, callback) {
      const email = await simpleParser(stream);
      inbox.emails.push({
        envelope: {
          from: session.envelope.mailFrom.address,
          to: session.envelope.rcptTo.map(({ address }) => address),
        },
        from: email.from.value[0], // { name, address }
        to: email.to.text,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
      callback();
    },
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  inbox.port = server.server.address().port;
  inbox.clear = () => {
    inbox.emails.length = 0;
    inbox.logins.length = 0;
    inbox.refuse = false;
  };
  inbox.stop = () => new Promise((resolve) => server.close(resolve));
  return inbox;
}
