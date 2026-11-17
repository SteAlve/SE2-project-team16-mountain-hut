import { describe, expect, it } from 'vitest';
import { bookingCancelledEmail } from '../../src/domain/bookingConfirmation.js';

const details = {
  email: 'giulia@example.com', bookingId: 42, firstName: 'Giulia', lastName: 'Rossi',
  date: '2027-07-17', startsAt: '13:00:00', endsAt: '14:00:00', partySize: 4,
  cancelledAt: '2027-07-14T11:32',
};

describe('bookingCancelledEmail (MH-08, email mockup 4)', () => {
  it('uses the agreed recipient, subject and complete plain-text wording', () => {
    const email = bookingCancelledEmail(details);
    expect(email.to).toBe(details.email);
    expect(email.subject).toBe('Your booking has been cancelled (QUOTA-00042)');
    expect(email.text).toBe([
      'Hello Giulia Rossi,', '',
      'Your booking QUOTA-00042 has been cancelled. The seats are free again for other guests.', '',
      'Booking reference: QUOTA-00042', 'Name: Giulia Rossi', 'Date: 17 July 2027',
      'Time: 13:00\u201314:00', 'Party size: 4', 'Cancelled on: 14 July 2027, 11:32', '',
      'We hope to see you at the hut another time.',
    ].join('\n'));
  });

  it('has the agreed HTML title, greeting, six labelled rows and closing', () => {
    const { html } = bookingCancelledEmail(details);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toMatch(/<h1\b[^>]*>Your booking has been cancelled<\/h1>/);
    expect(html).toContain('Hello Giulia Rossi, your booking QUOTA-00042 has been cancelled. The seats are free again for other guests.');
    for (const [label, value] of [
      ['Booking reference', 'QUOTA-00042'], ['Name', 'Giulia Rossi'], ['Date', '17 July 2027'],
      ['Time', '13:00\u201314:00'], ['Party size', '4'], ['Cancelled on', '14 July 2027, 11:32'],
    ]) {
      expect(html).toContain(`>${label}</td>`);
      expect(html).toContain(`>${value}</td>`);
    }
    expect(html).toContain('We hope to see you at the hut another time.');
    expect(html).not.toContain('See you at the hut!');
  });

  it('excludes dietary needs and table assignments even when the booking contains them', () => {
    const email = bookingCancelledEmail({
      ...details,
      requirements: [{ diets: ['VEGAN'], allergies: ['PEANUTS'], otherDiet: 'secret diet', otherAllergy: 'secret allergy', otherRequests: 'secret request' }],
      tables: [{ tableNumber: 987, seats: 4 }],
      tableAssignments: [{ tableId: 654, seatCount: 4 }],
    });
    for (const body of [email.text, email.html]) {
      expect(body).not.toMatch(/dietary|vegan|peanuts|secret|allerg|987|654/i);
      expect(body).not.toMatch(/table\s*(number|assignment|n\.|#)/i);
    }
  });

  it('escapes every HTML special character in user-controlled names while preserving plain text', () => {
    const email = bookingCancelledEmail({ ...details, firstName: '<img src="x">', lastName: "O'Neil & Co" });
    expect(email.text).toContain('Hello <img src="x"> O\'Neil & Co,');
    expect(email.html).toContain('&lt;img src=&quot;x&quot;&gt; O&#39;Neil &amp; Co');
    expect(email.html).not.toContain('<img');
    expect(email.html).not.toContain("O'Neil & Co");
  });

  it.each([[1, 'QUOTA-00001'], [99999, 'QUOTA-99999'], [100000, 'QUOTA-100000']])(
    'formats reference %i without truncating it', (bookingId, reference) => {
      const email = bookingCancelledEmail({ ...details, bookingId });
      expect(email.subject).toBe(`Your booking has been cancelled (${reference})`);
      expect(email.text).toContain(`Booking reference: ${reference}`);
      expect(email.html).toContain(`>${reference}</td>`);
    },
  );
});
