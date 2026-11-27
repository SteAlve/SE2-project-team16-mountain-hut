/**
 * The menu of a slot (MH-10): free text written by the staff and read by the hikers (product owner,
 * SE2-Polito/AY26-27-Mountain-Hut#39). Its formatting is a small subset of Markdown, the one the
 * editor of the mockup writes (docs/mockups/menus/README.md, "Fields and rules"):
 *   **bold**, *italic*, "- " for an item and two spaces before "- " for a sub-item.
 * Headings, links, images and HTML tags are refused, because they look like formatting the editor
 * does not have. Any other text is kept as it is and shown as plain text, also when it looks like
 * other Markdown ("1. Soup", "> note", "`x`"): a numbered line is normal text in a menu. The menu is
 * always shown escaped, so this is about keeping the text the editor can open again, not about safety.
 *
 * The length is counted in Unicode code points, like char_length in PostgreSQL: most emojis count as
 * one, but a flag counts as two and an emoji made of several (a family) as more.
 *
 * Errors carry a code, so the client shows the message of the mockup under the field:
 *   MENU_EMPTY      only spaces, empty lines, empty items or formatting marks
 *   MENU_TOO_LONG   more than MENU_MAX_LENGTH characters
 *   MENU_FORMAT     a heading, a link, an image, an HTML tag, or a sub-item not under an item
 * and isMenuOpen says until when a menu can still be changed or deleted (MENU_LOCKED, 422, in the use
 * cases).
 */
import { ValidationError } from './errors.js';

export const MENU_MAX_LENGTH = 2000;

// When the staff can still write, change or delete the menu of a slot: until the slot starts, that
// instant included, as the reservations of the staff (bookingWindow.js, isOpenForStaff). Once the slot
// has started its menu stays as it is (product owner, SE2-Polito/AY26-27-Mountain-Hut#59). The times
// arrive as parameters: domain/ never reads the clock.
export const isMenuOpen = (slotStartsAt, now) => now.getTime() <= slotStartsAt.getTime();

const ITEM = /^- /;
const SUB_ITEM = /^ {2}- /;
const HEADING = /^#{1,6}\s/;
const LINK_OR_IMAGE = /!?\[[^\]]*\]\([^)]*\)/;
// Only the names of real HTML elements, so that a text such as "Soup <with bread>" is not taken for HTML.
const HTML_ELEMENTS = [
  'a', 'abbr', 'b', 'blockquote', 'body', 'br', 'button', 'code', 'del', 'div', 'em', 'embed', 'font',
  'form', 'h[1-6]', 'head', 'hr', 'html', 'i', 'iframe', 'img', 'input', 'li', 'link', 'mark', 'meta',
  'object', 'ol', 'p', 'pre', 's', 'script', 'small', 'span', 'strong', 'style', 'sub', 'sup', 'svg',
  'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul', 'video',
];
const HTML_TAG = new RegExp(`<\\/?(?:${HTML_ELEMENTS.join('|')})(?:\\s[^>]*)?\\/?>`, 'i');

// Code points, as PostgreSQL's char_length counts them (see the comment at the top).
const lengthOf = (text) => [...text].length;

// What is left once the formatting marks and the spaces are taken away.
const visibleText = (text) => text
  .split('\n')
  .map((line) => line.replace(/^\s*-\s?/, '').replace(/\*/g, ''))
  .join('')
  .replace(/\s/g, '');

const checkLines = (lines) => {
  let previousIsItem = false;
  for (const line of lines) {
    if (line === '') { previousIsItem = false; continue; }
    if (HEADING.test(line) || LINK_OR_IMAGE.test(line) || HTML_TAG.test(line)) {
      throw new ValidationError('The menu can use only bold, italic, items and sub-items', { code: 'MENU_FORMAT' });
    }
    if (/^\s/.test(line)) {
      // Only a sub-item may start with spaces, and only right after an item or another sub-item.
      if (!SUB_ITEM.test(line) || !previousIsItem) {
        throw new ValidationError('A sub-item goes under an item, with two spaces before "- "', { code: 'MENU_FORMAT' });
      }
      continue;
    }
    previousIsItem = ITEM.test(line);
  }
};

// The menu as it is stored: Windows line ends turned into \n, the spaces at the end of each line and
// the empty lines at the start and at the end removed. Throws a ValidationError (400) when a rule fails.
export const normalizeMenu = (text) => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const menu = lines.join('\n');

  if (visibleText(menu) === '') {
    throw new ValidationError('Write the menu, or start from a previous one', { code: 'MENU_EMPTY' });
  }
  if (lengthOf(menu) > MENU_MAX_LENGTH) {
    throw new ValidationError(`The menu can be at most ${MENU_MAX_LENGTH} characters`, { code: 'MENU_TOO_LONG' });
  }
  checkLines(lines);
  return menu;
};
