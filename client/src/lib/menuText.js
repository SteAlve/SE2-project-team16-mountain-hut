/**
 * LIB: the text of a menu (MH-10, mockup docs/mockups/menus, "Fields and rules").
 * A menu is free text with a small subset of Markdown, the one the server accepts (server
 * domain/menu.js): **bold**, *italic*, "- " at the start of a line for an item and two spaces before
 * "- " for a sub-item. Nothing else is formatting: the rest is shown as plain text, always escaped.
 *
 *   parseMenu(text)      the lines of a menu, ready to be drawn: [{ kind: 'line' | 'blank' | 'list', ... }]
 *   menuSummary(text)    the first words on one line: "Lunch · Barley soup · Apple strudel"
 *   menuLength(text)     the characters, counted as the server counts them (code points)
 *   checkMenu(text)      the message under the field when the menu cannot be saved, or null
 *   menuToHtml(text)     the HTML the editor opens with
 *   domToMenu(root)      the text of what is in the editor (a DOM node, read through childNodes only)
 */

export const MENU_MAX_LENGTH = 2000;
export const MENU_EMPTY_MESSAGE = 'Write the menu, or start from a previous one.';
export const MENU_TOO_LONG_MESSAGE = `The menu can be at most ${MENU_MAX_LENGTH} characters.`;
export const MENU_FORMAT_MESSAGE = 'The menu can use only bold, italic, items and sub-items.';

const ITEM = /^- (.*)$/;
const SUB_ITEM = /^ {2,}- (.*)$/;

// As the server stores it: \n line ends, no spaces at the end of a line, no empty lines around it.
export function normalizeMenu(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((line) => line.replace(/\s+$/, ''));
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

export const menuLength = (text) => [...normalizeMenu(text)].length;

// What is left once the formatting marks and the spaces are taken away (as the server checks it).
const visibleText = (text) => text
  .split('\n')
  .map((line) => line.replace(/^\s*-\s?/, '').replace(/\*/g, ''))
  .join('')
  .replace(/\s/g, '');

export function checkMenu(text) {
  const menu = normalizeMenu(text);
  if (visibleText(menu) === '') return MENU_EMPTY_MESSAGE;
  if ([...menu].length > MENU_MAX_LENGTH) return MENU_TOO_LONG_MESSAGE;
  return null;
}

// ---------- reading the text ----------

// The runs of one line: [{ text, bold, italic }]. A run of stars toggles the formats: one star italic,
// two bold, three both (as domToMenu writes them). A star with no partner is kept as a star.
export function parseInline(line) {
  const parts = line.split(/(\*{1,3})/).filter((part) => part !== '');
  const literal = new Set();
  // Find the stars with no partner (from the end), and read them as text; then read the line again.
  for (let attempt = 0; attempt < parts.length; attempt += 1) {
    const open = { bold: -1, italic: -1 };
    parts.forEach((part, index) => {
      if (literal.has(index) || !/^\*+$/.test(part)) return;
      if (part.length !== 2) open.italic = open.italic === -1 ? index : -1;
      if (part.length >= 2) open.bold = open.bold === -1 ? index : -1;
    });
    const unmatched = Math.max(open.bold, open.italic);
    if (unmatched === -1) break;
    literal.add(unmatched);
  }

  const runs = [];
  let bold = false;
  let italic = false;
  parts.forEach((part, index) => {
    if (!literal.has(index) && /^\*+$/.test(part)) {
      if (part.length !== 2) italic = !italic;
      if (part.length >= 2) bold = !bold;
      return;
    }
    const last = runs[runs.length - 1];
    if (last && last.bold === bold && last.italic === italic) last.text += part;
    else runs.push({ text: part, bold, italic });
  });
  return runs;
}

// The menu, line by line: { kind: 'line', runs }, { kind: 'blank' } or
// { kind: 'list', items: [{ runs, subItems: [runs] }] } for the items next to each other.
export function parseMenu(text) {
  const blocks = [];
  for (const line of normalizeMenu(text ?? '').split('\n')) {
    const sub = SUB_ITEM.exec(line);
    const item = sub ? null : ITEM.exec(line);
    if (sub || item) {
      let list = blocks[blocks.length - 1];
      if (list?.kind !== 'list') {
        list = { kind: 'list', items: [] };
        blocks.push(list);
      }
      const runs = parseInline((sub ?? item)[1]);
      const parent = list.items[list.items.length - 1];
      // A sub-item with no item above it (the server refuses it) is drawn as an item.
      if (sub && parent) parent.subItems.push(runs);
      else list.items.push({ runs, subItems: [] });
    } else if (line.trim() === '') {
      if (blocks.length > 0) blocks.push({ kind: 'blank' });
    } else {
      blocks.push({ kind: 'line', runs: parseInline(line.trim()) });
    }
  }
  return blocks;
}

const plain = (runs) => runs.map((run) => run.text).join('').trim();

// Every line with some text, without the formatting, one after the other.
export function menuSummary(text) {
  const lines = [];
  for (const block of parseMenu(text)) {
    if (block.kind === 'line') lines.push(plain(block.runs));
    if (block.kind === 'list') {
      for (const item of block.items) lines.push(plain(item.runs), ...item.subItems.map(plain));
    }
  }
  return lines.filter(Boolean).join(' · ');
}

// ---------- the editor ----------

const escapeHtml = (text) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const runsToHtml = (runs) => runs.map(({ text, bold, italic }) => {
  let html = escapeHtml(text);
  if (italic) html = `<i>${html}</i>`;
  if (bold) html = `<b>${html}</b>`;
  return html;
}).join('');

export function menuToHtml(text) {
  return parseMenu(text).map((block) => {
    if (block.kind === 'blank') return '<div><br></div>';
    if (block.kind === 'line') return `<div>${runsToHtml(block.runs) || '<br>'}</div>`;
    const items = block.items.map(({ runs, subItems }) => {
      const subs = subItems.length > 0
        ? `<ul>${subItems.map((sub) => `<li>${runsToHtml(sub) || '<br>'}</li>`).join('')}</ul>`
        : '';
      return `<li>${runsToHtml(runs) || '<br>'}${subs}</li>`;
    }).join('');
    return `<ul>${items}</ul>`;
  }).join('');
}

// The marks of a line: the formats change only between words, so "**Dinner** soup", not "**Dinner **soup".
function runsToMarkdown(runs) {
  let out = '';
  let bold = false;
  let italic = false;
  let spaces = '';
  for (const run of runs) {
    const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(run.text);
    if (core === '') {
      spaces += run.text;
      continue;
    }
    if (italic && !run.italic) out += '*';
    if (bold && !run.bold) out += '**';
    out += spaces + lead;
    if (!bold && run.bold) out += '**';
    if (!italic && run.italic) out += '*';
    out += core;
    bold = run.bold;
    italic = run.italic;
    spaces = trail;
  }
  if (italic) out += '*';
  if (bold) out += '**';
  return out + spaces;
}

const BLOCK_ELEMENTS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'HEADER', 'HR', 'LI', 'P', 'PRE', 'SECTION', 'TABLE', 'TR',
]);

// The format inside an element: <b>, <strong>, <i>, <em>, or a style the browser wrote.
function formatOf(element, format) {
  const name = element.nodeName.toUpperCase();
  const style = element.getAttribute?.('style') ?? '';
  let { bold, italic } = format;
  if (name === 'B' || name === 'STRONG') bold = true;
  if (name === 'I' || name === 'EM') italic = true;
  const weight = /font-weight:\s*([a-z0-9]+)/i.exec(style)?.[1];
  if (weight) bold = weight === 'bold' || weight === 'bolder' || Number(weight) >= 600;
  const fontStyle = /font-style:\s*([a-z]+)/i.exec(style)?.[1];
  if (fontStyle) italic = fontStyle === 'italic' || fontStyle === 'oblique';
  return { bold, italic };
}

// The lines of a block: a <br> ends a line, a block or a list inside it starts new ones.
function readBlock(node, format, kind, lines) {
  let runs = [];
  const flush = (evenEmpty) => {
    if (runs.length > 0 || evenEmpty) lines.push({ kind, runs });
    runs = [];
  };
  const visit = (parent, current) => {
    for (const child of parent.childNodes) {
      if (child.nodeType === 3) {
        runs.push({ text: child.nodeValue.replace(/\u00a0/g, ' ').replace(/\n/g, ' '), ...current });
        continue;
      }
      if (child.nodeType !== 1) continue;
      const name = child.nodeName.toUpperCase();
      if (name === 'BR') {
        flush(true);
      } else if (name === 'UL' || name === 'OL') {
        flush(false);
        readList(child, current, kind === 'p' ? 1 : 2, lines);
      } else if (BLOCK_ELEMENTS.has(name)) {
        flush(false);
        readBlock(child, current, kind, lines);
      } else {
        visit(child, formatOf(child, current));
      }
    }
  };
  visit(node, format);
  flush(false);
}

// A list: its items are at `level` (1 item, 2 sub-item: a deeper list is still a sub-item). Some
// browsers put the list of the sub-items next to the item instead of inside it: it is read the same.
function readList(list, format, level, lines) {
  const kind = level === 1 ? 'item' : 'sub';
  for (const child of list.childNodes) {
    const name = child.nodeType === 1 ? child.nodeName.toUpperCase() : '';
    if (name === 'UL' || name === 'OL') readList(child, format, 2, lines);
    else if (child.nodeType === 1 || child.nodeType === 3) readBlock({ childNodes: [child] }, format, kind, lines);
  }
}

export function domToMenu(root) {
  const lines = [];
  readBlock(root, { bold: false, italic: false }, 'p', lines);

  const text = [];
  let afterItem = false;
  for (const { kind, runs } of lines) {
    const markdown = runsToMarkdown(runs).trim();
    if (kind === 'p') {
      text.push(markdown);
      afterItem = false;
    } else if (markdown !== '') {
      // An empty item is left out; a sub-item with no item above it becomes an item.
      text.push(kind === 'sub' && afterItem ? `  - ${markdown}` : `- ${markdown}`);
      afterItem = true;
    }
  }
  return normalizeMenu(text.join('\n'));
}
