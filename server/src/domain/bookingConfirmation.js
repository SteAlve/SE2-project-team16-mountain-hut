/**
 * The confirmation email of a booking (MH-03): who receives it and what it says. A pure function:
 * sending it is the job of the mailer.
 *
 * It has an HTML version and a plain text one, for the email apps that do not show HTML. The HTML
 * uses tables and inline styles because that is what email apps support; the colours are the
 * tokens of the client (client/src/index.css).
 *
 * The party requirements are not in the email yet: they arrive with MH-05.
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

const seats = (count) => `${count} ${count === 1 ? 'seat' : 'seats'}`;

const tableList = (tables) => tables
  .map(({ tableNumber, seats: count }) => `Table ${tableNumber} (${seats(count)})`)
  .join(', ');

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

const blazeBar = (color) => `<td width="28" height="6" style="background:${color};font-size:0;line-height:0;">&nbsp;</td>`;

const toHtml = ({ name, ref, date, slotTime, partySize, tables }) => `<!doctype html>
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
                ${row('Tables', tables)}
              </table>
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
  tables,
}) => {
  const name = `${firstName} ${lastName}`;
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
      `Tables: ${tableList(tables)}`,
      '',
      'See you at the hut!',
    ].join('\n'),
    html: toHtml({
      name: escapeHtml(name),
      ref,
      date: day(date),
      slotTime,
      partySize,
      tables: tableList(tables),
    }),
  };
};
