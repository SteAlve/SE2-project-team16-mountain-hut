/**
 * The email after a hiker registered a hike (MH-20): the details of the hike, one line each, and the
 * passage points in order when there are any. A hike without a start starts at the hut, and the
 * email names it. Same layout, sender and colours as the other emails
 * (domain/emailLayout.js, mockup docs/mockups/emails, email 6). A pure function: sending it is the
 * job of the mailer.
 *
 * The start, the destination, the route and the passage points are typed by the hiker, so they are
 * escaped in the HTML. The route can have more than one line, and it keeps them in the HTML too. The
 * times are the local time of the hut: 'YYYY-MM-DDTHH:MM'.
 */
import {
  closing, detailRow, emailPage, escapeHtml, FONT, HUT_NAME, INK, moment, paragraph,
} from './emailLayout.js';

const END = 'Have a good hike!';

// A text typed by the hiker, safe in the HTML, with its line breaks.
const linesHtml = (text) => escapeHtml(text).replace(/\r\n|\r|\n/g, '<br>');

export const hikeRegisteredEmail = ({
  email, firstName, lastName, start, destination, route, passagePoints, departureAt, returnAt,
  registeredAt,
}) => {
  const name = `${firstName} ${lastName}`;
  const rows = [
    ['Name', name],
    ['Start', start ?? HUT_NAME],
    ['Destination', destination],
    ['Route', route],
    ['Departure', moment(departureAt)],
    ['Expected return', moment(returnAt)],
    ['Registered on', moment(registeredAt)],
  ];

  const pointsHtml = passagePoints.length === 0 ? '' : `
              <h2 style="${FONT}margin:24px 0 8px;color:${INK};font-size:16px;">Passage points</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${detailRow('In order', passagePoints.map(escapeHtml).join('<br>'))}
              </table>`;

  return {
    to: email,
    subject: `Your hike is registered: ${destination}`,
    text: [
      `Hello ${name},`,
      '',
      'Your hike is registered. These are the details:',
      '',
      ...rows.map(([label, value]) => `${label}: ${value}`),
      ...(passagePoints.length === 0 ? [] : ['', 'Passage points, in order:', ...passagePoints.map((point) => `- ${point}`)]),
      '',
      END,
    ].join('\n'),
    html: emailPage({
      heading: 'Your hike is registered',
      bodyHtml: `${paragraph(`Hello ${escapeHtml(name)}, here are the details of the hike you registered.`)}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
                ${rows.map(([label, value]) => detailRow(label, linesHtml(value))).join('')}
              </table>${pointsHtml}${closing(END)}`,
    }),
  };
};
