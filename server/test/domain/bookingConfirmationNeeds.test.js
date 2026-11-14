// MH-05 Provide party requirements: how the dietary needs of a booking appear in the confirmation
// email (a pure function: no database, no SMTP). The rest of the email is MH-03.
import { describe, expect, it } from 'vitest';
import { bookingConfirmationEmail } from '../../src/domain/bookingConfirmation.js';

const booking = {
  email: 'mara.rossi@example.com',
  bookingId: 45,
  firstName: 'Mara',
  lastName: 'Rossi',
  date: '2090-11-04',
  startsAt: '12:00:00',
  endsAt: '13:00:00',
  partySize: 6,
};

const need = (fields) => ({
  diets: [], otherDiet: null, allergies: [], otherAllergy: null, otherRequests: null, ...fields,
});
const withAllergies = (fields) => {
  const line = need(fields);
  return { ...line, hasAllergies: line.allergies.length > 0 || line.otherAllergy !== null };
};

const emailFor = (requirements) => bookingConfirmationEmail({ ...booking, requirements });

// The text lines after the "Dietary needs:" heading, up to the closing line.
const needsLines = (text) => {
  const lines = text.split('\n');
  const from = lines.indexOf('Dietary needs:');
  if (from === -1) return null;
  return lines.slice(from + 1, lines.indexOf('See you at the hut!') - 1);
};

describe('a booking without dietary needs', () => {
  it.each([
    ['not given', undefined],
    ['an empty list', []],
  ])('has no section about them when they are %s', (_name, requirements) => {
    const { text, html } = emailFor(requirements);
    expect(text).not.toContain('Dietary needs');
    expect(html).not.toContain('Dietary needs');
  });
});

describe('the dietary needs in the text of the email', () => {
  it('lists them after the details of the booking, before the greeting that closes the email', () => {
    const { text } = emailFor([withAllergies({ diets: ['VEGAN'], allergies: ['PEANUTS'] })]);
    expect(text).toBe([
      'Hello Mara Rossi,',
      '',
      'Your table is booked. These are the details:',
      '',
      'Booking reference: QUOTA-00045',
      'Name: Mara Rossi',
      'Date: 4 November 2090',
      'Time: 12:00–13:00',
      'Party size: 6',
      '',
      'Dietary needs:',
      '- 1 guest: Allergies: Peanuts · Diet: Vegan',
      '',
      'See you at the hut!',
    ].join('\n'));
  });

  it('writes one line for each different need, in the order the hiker gave them (the example of the story)', () => {
    const { text } = emailFor([
      withAllergies({ diets: ['VEGAN'], allergies: ['PEANUTS'] }),
      withAllergies({ allergies: ['SHELLFISH'] }),
      withAllergies({ diets: ['VEGETARIAN'] }),
      withAllergies({ diets: ['VEGETARIAN'] }),
    ]);
    expect(needsLines(text)).toEqual([
      '- 1 guest: Allergies: Peanuts · Diet: Vegan',
      '- 1 guest: Allergies: Shellfish',
      '- 2 guests: Diet: Vegetarian',
    ]);
  });

  it('shows once the guests with exactly the same needs, with how many they are', () => {
    const same = withAllergies({ diets: ['VEGAN', 'LACTOSE_FREE'], allergies: ['GLUTEN'] });
    const { text } = emailFor([same, { ...same }, { ...same }]);
    expect(needsLines(text)).toEqual(['- 3 guests: Allergies: Gluten · Diet: Vegan, Lactose-free']);
  });

  it('does not join guests whose needs only look alike', () => {
    const { text } = emailFor([
      withAllergies({ diets: ['VEGAN'] }),
      withAllergies({ diets: ['VEGAN'], otherRequests: 'No onion' }),
      withAllergies({ otherDiet: 'Vegan' }),
    ]);
    expect(needsLines(text)).toEqual([
      '- 1 guest: Diet: Vegan',
      '- 1 guest: Diet: Vegan · "No onion"',
      '- 1 guest: Diet: Vegan',
    ]);
  });

  it('joins the guests of the same needs even when the lines are not next to each other', () => {
    const vegan = withAllergies({ diets: ['VEGAN'] });
    const { text } = emailFor([vegan, withAllergies({ allergies: ['EGGS'] }), { ...vegan }]);
    expect(needsLines(text)).toEqual([
      '- 2 guests: Diet: Vegan',
      '- 1 guest: Allergies: Eggs',
    ]);
  });

  it.each([
    ['VEGETARIAN', 'Vegetarian'],
    ['VEGAN', 'Vegan'],
    ['PESCATARIAN', 'Pescatarian'],
    ['LACTOSE_FREE', 'Lactose-free'],
  ])('says the diet %s as "%s", not as its code', (code, words) => {
    const { text } = emailFor([withAllergies({ diets: [code] })]);
    expect(needsLines(text)).toEqual([`- 1 guest: Diet: ${words}`]);
    expect(text).not.toContain(code);
  });

  it.each([
    ['GLUTEN', 'Gluten'],
    ['MILK', 'Milk'],
    ['EGGS', 'Eggs'],
    ['PEANUTS', 'Peanuts'],
    ['TREE_NUTS', 'Tree nuts'],
    ['FISH', 'Fish'],
    ['SHELLFISH', 'Shellfish'],
  ])('says the allergy %s as "%s", not as its code', (code, words) => {
    const { text } = emailFor([withAllergies({ allergies: [code] })]);
    expect(needsLines(text)).toEqual([`- 1 guest: Allergies: ${words}`]);
    expect(text).not.toContain(code);
  });

  it('writes the "other" allergy after the preset ones and the "other" diet after the preset ones', () => {
    const { text } = emailFor([withAllergies({
      diets: ['VEGETARIAN'], otherDiet: 'Halal', allergies: ['MILK', 'FISH'], otherAllergy: 'Kiwi',
    })]);
    expect(needsLines(text)).toEqual(['- 1 guest: Allergies: Milk, Fish, Kiwi · Diet: Vegetarian, Halal']);
  });

  it('gives the allergies first, as the kitchen reads them, then the diet, then the request', () => {
    const { text } = emailFor([withAllergies({
      diets: ['PESCATARIAN'], allergies: ['TREE_NUTS'], otherRequests: 'Small portion',
    })]);
    expect(needsLines(text)).toEqual(['- 1 guest: Allergies: Tree nuts · Diet: Pescatarian · "Small portion"']);
  });

  it('keeps out of the line the parts that the guest does not have', () => {
    const { text } = emailFor([
      withAllergies({ otherRequests: 'High chair' }),
      withAllergies({ otherAllergy: 'Kiwi' }),
      withAllergies({ otherDiet: 'Halal' }),
    ]);
    expect(needsLines(text)).toEqual([
      '- 1 guest: "High chair"',
      '- 1 guest: Allergies: Kiwi',
      '- 1 guest: Diet: Halal',
    ]);
  });
});

describe('the dietary needs in the HTML of the email', () => {
  const sectionOf = (html) => html.match(/Dietary needs<\/h2>[\s\S]*?<\/table>/)[0];

  it('has a section "Dietary needs" with one row for each different need', () => {
    const { html } = emailFor([
      withAllergies({ diets: ['VEGAN'], allergies: ['PEANUTS'] }),
      withAllergies({ diets: ['VEGETARIAN'] }),
      withAllergies({ diets: ['VEGETARIAN'] }),
    ]);
    const section = sectionOf(html);
    expect(section.match(/<tr>/g)).toHaveLength(2);
    expect(section).toMatch(/>1 guest<\/td>/);
    expect(section).toMatch(/>2 guests<\/td>/);
    expect(section).toContain('Diet: Vegan');
    expect(section).toContain('Diet: Vegetarian');
  });

  it('puts the section after the details of the booking', () => {
    const { html } = emailFor([withAllergies({ diets: ['VEGAN'] })]);
    expect(html.indexOf('Party size')).toBeGreaterThan(-1);
    expect(html.indexOf('Dietary needs')).toBeGreaterThan(html.indexOf('Party size'));
    expect(html.indexOf('See you at the hut!')).toBeGreaterThan(html.indexOf('Dietary needs'));
  });

  it('shows the allergies in a different style, so the kitchen sees that special care is needed', () => {
    const { html } = emailFor([
      withAllergies({ allergies: ['SHELLFISH'] }),
      withAllergies({ diets: ['VEGAN'] }),
    ]);
    const [allergyRow, dietRow] = sectionOf(html).split('</tr>');
    expect(allergyRow).toMatch(/<span style="[^"]*font-weight:bold;">Allergies: Shellfish<\/span>/);
    expect(dietRow).not.toContain('Allergies');
    expect(dietRow).not.toMatch(/font-weight:bold/);
  });

  it('does not show a line of diet and requests as an allergy', () => {
    const { html } = emailFor([withAllergies({ diets: ['VEGAN'], otherRequests: 'No onion' })]);
    expect(sectionOf(html)).not.toContain('Allergies');
  });

  it('writes what the hiker typed as text, never as HTML', () => {
    const { html } = emailFor([withAllergies({
      otherDiet: '<b>Raw</b>',
      otherAllergy: '<script>alert(1)</script>',
      otherRequests: 'Fish & "chips" <i>please</i>',
    })]);
    const section = sectionOf(html);
    expect(section).not.toContain('<b>');
    expect(section).not.toContain('<script>');
    expect(section).not.toContain('<i>');
    expect(section).toContain('&lt;b&gt;Raw&lt;/b&gt;');
    expect(section).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(section).toContain('Fish &amp; &quot;chips&quot; &lt;i&gt;please&lt;/i&gt;');
  });

  it('keeps what the hiker typed as it is in the text version', () => {
    const { text } = emailFor([withAllergies({ otherRequests: 'Fish & <chips>' })]);
    expect(needsLines(text)).toEqual(['- 1 guest: "Fish & <chips>"']);
  });
});

describe('the dietary needs do not change the rest of the email', () => {
  it('keeps the recipient, the subject and the details of the booking', () => {
    const plain = emailFor([]);
    const withNeeds = emailFor([withAllergies({ diets: ['VEGAN'], allergies: ['PEANUTS'] })]);

    expect(withNeeds.to).toBe('mara.rossi@example.com');
    expect(withNeeds.subject).toBe(plain.subject);
    expect(withNeeds.subject).toBe('Your table is booked (QUOTA-00045)');
    for (const line of ['Booking reference: QUOTA-00045', 'Name: Mara Rossi', 'Party size: 6']) {
      expect(withNeeds.text).toContain(line);
    }
  });
});
