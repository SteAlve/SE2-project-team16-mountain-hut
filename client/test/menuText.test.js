import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MENU_EMPTY_MESSAGE,
  MENU_TOO_LONG_MESSAGE,
  checkMenu,
  domToMenu,
  menuLength,
  menuSummary,
  menuToHtml,
  parseInline,
  parseMenu,
} from '../src/lib/menuText.js';

const MENU = [
  '**Dinner – three courses**',
  '- Starters',
  '  - Canederli in broth',
  '- Main courses',
  '  - Polenta with porcini mushrooms *(vegetarian)*',
  '*Coffee included.*',
].join('\n');

// A small stand-in for the DOM of the editor: only what domToMenu reads.
const text = (value) => ({ nodeType: 3, nodeName: '#text', nodeValue: value, childNodes: [] });
const el = (name, children = [], style = '') => ({
  nodeType: 1,
  nodeName: name,
  childNodes: children.map((child) => (typeof child === 'string' ? text(child) : child)),
  getAttribute: (attr) => (attr === 'style' ? style : null),
});

test('reads bold, italic and both, and keeps a lone star as a star', () => {
  assert.deepEqual(parseInline('**Dinner** soup'), [
    { text: 'Dinner', bold: true, italic: false },
    { text: ' soup', bold: false, italic: false },
  ]);
  assert.deepEqual(parseInline('**Dinner *x***'), [
    { text: 'Dinner ', bold: true, italic: false },
    { text: 'x', bold: true, italic: true },
  ]);
  assert.deepEqual(parseInline('5 * 3 apples'), [{ text: '5 * 3 apples', bold: false, italic: false }]);
});

test('groups the items and their sub-items', () => {
  const blocks = parseMenu(MENU);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].kind, 'line');
  assert.equal(blocks[1].kind, 'list');
  assert.equal(blocks[1].items.length, 2);
  assert.equal(blocks[1].items[1].subItems[0][1].italic, true);
  assert.equal(blocks[2].runs[0].italic, true);
});

test('the summary is every line without its marks', () => {
  assert.equal(
    menuSummary(MENU),
    'Dinner – three courses · Starters · Canederli in broth · Main courses · Polenta with porcini mushrooms (vegetarian) · Coffee included.',
  );
});

test('a menu with no visible text, or too long, cannot be saved', () => {
  assert.equal(checkMenu('  \n- \n**  **'), MENU_EMPTY_MESSAGE);
  assert.equal(checkMenu('x'.repeat(2001)), MENU_TOO_LONG_MESSAGE);
  assert.equal(checkMenu('x'.repeat(2000)), null);
  assert.equal(menuLength('\n\n🍲 soup  \n'), 6);
});

test('the editor opens with escaped HTML', () => {
  assert.equal(
    menuToHtml('**<b>Soup</b>**\n- A\n  - *B*'),
    '<div><b>&lt;b&gt;Soup&lt;/b&gt;</b></div><ul><li>A<ul><li><i>B</i></li></ul></li></ul>',
  );
});

test('what is in the editor becomes the text of the menu', () => {
  const root = el('DIV', [
    el('DIV', [el('B', ['Dinner – three courses'])]),
    el('UL', [
      el('LI', ['Starters', el('UL', [el('LI', ['Canederli in broth'])])]),
      el('LI', ['Main courses']),
      // Chrome indents an item by putting a list next to it.
      el('UL', [el('LI', ['Polenta with porcini mushrooms ', el('I', ['(vegetarian)'])])]),
    ]),
    el('DIV', [el('SPAN', ['Coffee included.'], 'font-style: italic;')]),
  ]);
  assert.equal(domToMenu(root), MENU);
});

test('lines, empty lines and spaces around the formats', () => {
  const root = el('DIV', [
    'Lunch',
    el('DIV', [el('BR')]),
    el('DIV', [el('B', ['Soup ']), 'of the day', el('BR'), el('I', ['and ', el('B', ['bread'])])]),
    el('UL', [el('LI', [el('BR')]), el('LI', ['\u00a0Tea'])]),
  ]);
  assert.equal(domToMenu(root), 'Lunch\n\n**Soup** of the day\n*and **bread***\n- Tea');
});

test('a sub-item with no item above it becomes an item', () => {
  const root = el('DIV', [el('UL', [el('UL', [el('LI', ['Soup'])])])]);
  assert.equal(domToMenu(root), '- Soup');
});

test('the text goes through the editor and back unchanged', () => {
  // menuToHtml then domToMenu, with the HTML read back by a tiny parser of the tags it writes.
  const parse = (html) => {
    const root = el('DIV');
    const stack = [root];
    for (const token of html.match(/<\/?[a-z]+>|[^<]+/g)) {
      const top = stack[stack.length - 1];
      if (token === '<br>') top.childNodes.push(el('BR'));
      else if (token.startsWith('</')) stack.pop();
      else if (token.startsWith('<')) {
        const node = el(token.slice(1, -1).toUpperCase());
        top.childNodes.push(node);
        stack.push(node);
      } else top.childNodes.push(text(token.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')));
    }
    return root;
  };
  assert.equal(domToMenu(parse(menuToHtml(MENU))), MENU);
});
