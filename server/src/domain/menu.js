/**
 * The menu of a slot (MH-10): free text written by the staff and read by the hikers (product owner,
 * SE2-Polito/AY26-27-Mountain-Hut#39). Its formatting is a small subset of Markdown, the one the
 * editor of the mockup writes (docs/mockups/menus/README.md, "Fields and rules"):
 *   **bold**, *italic*, "- " for an item and two spaces before "- " for a sub-item.
 * Nothing else is accepted: no headings, links, images or HTML. The menu is always shown escaped, so
 * this is about keeping the text the editor can open again, not about safety.
 *
 * Errors carry a code, so the client shows the message of the mockup under the field:
 *   MENU_EMPTY      only spaces, empty lines, empty items or formatting marks
 *   MENU_TOO_LONG   more than MENU_MAX_LENGTH characters
 *   MENU_FORMAT     something the editor does not write (a heading, a link, HTML, a deeper level)
 */
import { ValidationError } from './errors.js';

export const MENU_MAX_LENGTH = 2000;

const ITEM = /^- /;
const SUB_ITEM = /^ {2}- /;
const HEADING = /^#{1,6}\s/;
const LINK_OR_IMAGE = /!?\[[^\]]*\]\([^)]*\)/;
const HTML_TAG = /<\/?[a-z][^>]*>/i;

// Characters as the user counts them (and as PostgreSQL's char_length does): an emoji is one.
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
