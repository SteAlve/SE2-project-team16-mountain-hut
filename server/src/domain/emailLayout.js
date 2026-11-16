/**
 * The look shared by the account emails (MH-07): the QUOTA header and the white card, as in the
 * booking confirmation (domain/bookingConfirmation.js). Pure functions: sending is the mailer's job.
 *
 * The HTML uses tables and inline styles because that is what email apps support; the colours are
 * the tokens of the client (client/src/index.css).
 */
export const PINE = '#1d4a3a';
export const INK = '#10201a';
export const STONE = '#66736d';
export const LINE = '#d8dfda';
export const MIST = '#eef2ef';
export const BLAZE = '#e0352b';
export const FONT = 'font-family:Helvetica,Arial,sans-serif;';

// What a person typed (a name) or what was generated must never be read as HTML.
export const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const bar = (color) => `<td width="28" height="6" style="background:${color};font-size:0;line-height:0;">&nbsp;</td>`;

// A line of a list of details: a label and its value.
export const detailRow = (label, valueHtml) => `
  <tr>
    <td style="${FONT}padding:12px 0;border-top:1px solid ${LINE};color:${STONE};font-size:14px;">${label}</td>
    <td align="right" style="${FONT}padding:12px 0;border-top:1px solid ${LINE};color:${INK};font-size:15px;font-weight:bold;">${valueHtml}</td>
  </tr>`;

// A button that is a link. `href` and `label` must be already safe HTML.
export const linkButton = (href, label) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
    <tr>
      <td style="background:${PINE};border-radius:6px;">
        <a href="${href}" style="${FONT}display:inline-block;padding:14px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">${label}</a>
      </td>
    </tr>
  </table>`;

// For the email apps where the button does not work: the address written out, underlined, in pine.
// `href` must be already safe HTML.
export const fallbackLink = (href) => `
              <p style="${FONT}margin:16px 0 0;color:${STONE};font-size:13px;line-height:20px;">If the button does not work, copy this link into your browser:<br><a href="${href}" style="color:${PINE};text-decoration:underline;word-break:break-all;">${href}</a></p>`;

// The last line of the body, as in the booking confirmation.
export const closing = (text) => `
              <p style="${FONT}margin:24px 0 0;color:${INK};font-size:15px;">${text}</p>`;

// A note under a line, at the end of the body. `html` must be already safe HTML.
export const note = (html) => `
              <p style="${FONT}margin:24px 0 0;padding-top:16px;border-top:1px solid ${LINE};color:${STONE};font-size:13px;line-height:20px;">${html}</p>`;

// The whole page: the header, the heading, and the body (already safe HTML) in the white card.
export const emailPage = ({ heading, bodyHtml }) => `<!doctype html>
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
                <tr>${bar(BLAZE)}${bar('#ffffff')}${bar(BLAZE)}</tr>
              </table>
              <div style="${FONT}color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:4px;">QUOTA</div>
              <div style="${FONT}color:#9db3a9;font-size:12px;letter-spacing:1px;margin-top:4px;">RIFUGIO ALPE LUNGA &middot; 2.450 M</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="${FONT}margin:0 0 8px;color:${INK};font-size:26px;">${heading}</h1>${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// A paragraph of the body.
export const paragraph = (html) => `
              <p style="${FONT}margin:16px 0 0;color:${STONE};font-size:15px;line-height:22px;">${html}</p>`;
