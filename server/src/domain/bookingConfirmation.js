/**
 * The confirmation email of a booking (MH-03): who receives it and what it says. A pure function:
 * sending it is the job of the mailer.
 *
 * It has an HTML version and a plain text one, for the email apps that do not show HTML. The HTML
 * uses tables and inline styles because that is what email apps support; the colours are the
 * tokens of the client (client/src/index.css).
 *
 * What it contains comes from the product owner (issue #24 and MH-03): the reference, the date and
 * time, the party size, the name and the party requirements (MH-05). Table numbers are left out on
 * purpose. Guests with exactly the same needs are shown once, with how many they are, as on the
 * Table booked screen.
 */
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PINE = '#1d4a3a';
const INK = '#10201a';
const STONE = '#66736d';
const LINE = '#d8dfda';
const MIST = '#eef2ef';
const BLAZE = '#e0352b';
const FONT = "font-family:Helvetica,Arial,sans-serif;";

const time = (value) => value.slice(0, 5); // 'HH:MM:SS' -> 'HH:MM'

// 'YYYY-MM-DD' -> '4 November 2026'
const day = (date) => {
  const [year, month, dayOfMonth] = date.split('-').map(Number);
  return `${dayOfMonth} ${MONTHS[month - 1]} ${year}`;
};

const reference = (bookingId) => `QUOTA-${String(bookingId).padStart(5, '0')}`;

// A name is typed by the hiker, so it must never be read as HTML.
const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const row = (label, value) => `
  <tr>
    <td style="${FONT}padding:12px 0;border-top:1px solid ${LINE};color:${STONE};font-size:14px;">${label}</td>
    <td align="right" style="${FONT}padding:12px 0;border-top:1px solid ${LINE};color:${INK};font-size:15px;font-weight:bold;">${value}</td>
  </tr>`;

// The words of the preset diets and allergies (domain/dietaryNeeds.js).
const NEED_LABELS = {
  VEGETARIAN: 'Vegetarian',
  VEGAN: 'Vegan',
  PESCATARIAN: 'Pescatarian',
  LACTOSE_FREE: 'Lactose-free',
  GLUTEN: 'Gluten',
  MILK: 'Milk',
  EGGS: 'Eggs',
  PEANUTS: 'Peanuts',
  TREE_NUTS: 'Tree nuts',
  FISH: 'Fish',
  SHELLFISH: 'Shellfish',
};

// One entry per different line of needs, with how many guests have it, in the order of the lines.
const groupNeeds = (requirements) => {
  const groups = new Map();
  for (const line of requirements) {
    const key = JSON.stringify([line.diets, line.otherDiet, line.allergies, line.otherAllergy, line.otherRequests]);
    const group = groups.get(key) ?? { ...line, guests: 0 };
    group.guests += 1;
    groups.set(key, group);
  }
  return [...groups.values()];
};

// The parts of a line, in the words of the hiker: allergies first, as the kitchen reads them.
const needParts = ({ diets, otherDiet, allergies, otherAllergy, otherRequests }) => {
  const allergyWords = [...allergies.map((code) => NEED_LABELS[code]), ...(otherAllergy ? [otherAllergy] : [])];
  const dietWords = [...diets.map((code) => NEED_LABELS[code]), ...(otherDiet ? [otherDiet] : [])];
  return {
    allergies: allergyWords.length ? `Allergies: ${allergyWords.join(', ')}` : null,
    diets: dietWords.length ? `Diet: ${dietWords.join(', ')}` : null,
    request: otherRequests ? `"${otherRequests}"` : null,
  };
};

const guests = (count) => `${count} ${count === 1 ? 'guest' : 'guests'}`;

const needsText = (groups) => groups.map((group) => {
  const { allergies, diets, request } = needParts(group);
  return `- ${guests(group.guests)}: ${[allergies, diets, request].filter(Boolean).join(' · ')}`;
});

const needsHtml = (groups) => {
  if (groups.length === 0) return '';
  const lines = groups.map((group) => {
    const { allergies, diets, request } = needParts(group);
    const parts = [
      allergies && `<span style="color:${BLAZE};font-weight:bold;">${escapeHtml(allergies)}</span>`,
      diets && escapeHtml(diets),
      request && `<span style="color:${STONE};font-style:italic;">${escapeHtml(request)}</span>`,
    ].filter(Boolean).join('<br>');
    return `
                <tr>
                  <td valign="top" style="${FONT}padding:10px 0;border-top:1px solid ${LINE};color:${STONE};font-size:14px;white-space:nowrap;">${guests(group.guests)}</td>
                  <td style="${FONT}padding:10px 0 10px 16px;border-top:1px solid ${LINE};color:${INK};font-size:14px;line-height:20px;">${parts}</td>
                </tr>`;
  }).join('');
  return `
              <h2 style="${FONT}margin:24px 0 8px;color:${INK};font-size:16px;">Dietary needs</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${lines}
              </table>`;
};

const blazeBar = (color) => `<td width="28" height="6" style="background:${color};font-size:0;line-height:0;">&nbsp;</td>`;

const toHtml = ({ name, ref, date, slotTime, partySize, needs }) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:${MIST};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${MIST};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background:${PINE};padding:28px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>${blazeBar(BLAZE)}${blazeBar('#ffffff')}${blazeBar(BLAZE)}</tr>
              </table>
              <div style="${FONT}color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:4px;">QUOTA</div>
              <div style="${FONT}color:#9db3a9;font-size:12px;letter-spacing:1px;margin-top:4px;">RIFUGIO ALPE LUNGA &middot; 2.450 M</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="${FONT}margin:0 0 8px;color:${INK};font-size:26px;">Your table is booked</h1>
              <p style="${FONT}margin:0 0 24px;color:${STONE};font-size:15px;line-height:22px;">Hello ${name}, here are the details of your booking.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${row('Booking reference', ref)}
                ${row('Name', name)}
                ${row('Date', date)}
                ${row('Time', slotTime)}
                ${row('Party size', partySize)}
              </table>${needsHtml(needs)}
              <p style="${FONT}margin:24px 0 0;color:${INK};font-size:15px;">See you at the hut!</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const bookingConfirmationEmail = ({
  bookingId,
  firstName,
  lastName,
  email,
  date,
  startsAt,
  endsAt,
  partySize,
  requirements = [],
}) => {
  const name = `${firstName} ${lastName}`;
  const needs = groupNeeds(requirements);
  const ref = reference(bookingId);
  const slotTime = `${time(startsAt)}–${time(endsAt)}`;

  return {
    to: email,
    subject: `Your table is booked (${ref})`,
    text: [
      `Hello ${name},`,
      '',
      'Your table is booked. These are the details:',
      '',
      `Booking reference: ${ref}`,
      `Name: ${name}`,
      `Date: ${day(date)}`,
      `Time: ${slotTime}`,
      `Party size: ${partySize}`,
      ...(needs.length ? ['', 'Dietary needs:', ...needsText(needs)] : []),
      '',
      'See you at the hut!',
    ].join('\n'),
    html: toHtml({
      name: escapeHtml(name),
      ref,
      date: day(date),
      slotTime,
      partySize,
      needs,
    }),
  };
};
