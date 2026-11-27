/**
 * The "Menu" field of Write / Edit the menu (Figma "Menu editor", MH-10): a small editor with a
 * toolbar for bold, italic, a list, a sub-item and up a level, and the counter of the characters.
 *   - Ctrl+B / Ctrl+I as in any editor; Enter in a list adds the next item;
 *   - Tab moves an item one level in (two levels: items and sub-items), Shift+Tab back out;
 *   - the button of the format where the cursor is looks pressed.
 * The writing area keeps its height: a long menu scrolls inside it. Pasted text loses its format, so
 * only the formats of the toolbar can get in.
 *
 * It is a contentEditable area: what it holds is turned into the text of the menu (lib/menuText.js,
 * domToMenu) at every change and handed to `onChange(text)`. `initialValue` is read once: mount it
 * with a new `key` to put another menu in it (e.g. one copied from a previous menu).
 * `error` is the message under the field.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import listIcon from '../../assets/menus/list.svg';
import listActiveIcon from '../../assets/menus/list-active.svg';
import subItemIcon from '../../assets/menus/sub-item.svg';
import subItemActiveIcon from '../../assets/menus/sub-item-active.svg';
import upIcon from '../../assets/menus/up-a-level.svg';
import { MENU_MAX_LENGTH, domToMenu, menuLength, menuToHtml } from '../../lib/menuText.js';
import styles from './MenuEditor.module.css';

const NO_FORMAT = { bold: false, italic: false, level: 0 };

// How deep the cursor is in the lists: 0 outside, 1 in an item, 2 in a sub-item.
function listLevel(node, root) {
  let level = 0;
  for (let n = node; n && n !== root; n = n.parentNode) {
    if (n.nodeName === 'UL' || n.nodeName === 'OL') level += 1;
  }
  return Math.min(level, 2);
}

function FormatButton({ label, active, onClick, children }) {
  return (
    <button
      type="button"
      className={`${styles.format} ${active ? styles.active : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      // Keep the cursor in the menu: the button acts where it is.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function MenuEditor({ initialValue = '', error, onChange }) {
  const ref = useRef(null);
  const labelId = useId();
  const noteId = `${labelId}-note`;
  const [text, setText] = useState(initialValue);
  const [format, setFormat] = useState(NO_FORMAT);

  useLayoutEffect(() => {
    ref.current.innerHTML = menuToHtml(initialValue);
  }, [initialValue]);

  // The format where the cursor is, for the pressed buttons.
  const readFormat = useCallback(() => {
    const selection = document.getSelection();
    const root = ref.current;
    if (!root || !selection?.rangeCount || !root.contains(selection.anchorNode)) {
      setFormat(NO_FORMAT);
      return;
    }
    setFormat({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      level: listLevel(selection.anchorNode, root),
    });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', readFormat);
    return () => document.removeEventListener('selectionchange', readFormat);
  }, [readFormat]);

  const changed = () => {
    const menu = domToMenu(ref.current);
    setText(menu);
    onChange(menu);
    readFormat();
  };

  const run = (command) => {
    ref.current.focus();
    document.execCommand(command, false);
    changed();
  };

  const level = () => {
    const selection = document.getSelection();
    return selection?.rangeCount ? listLevel(selection.anchorNode, ref.current) : 0;
  };

  // In: an item becomes a sub-item (a sub-item stays one); a line becomes an item.
  const moveIn = () => {
    const current = level();
    if (current === 0) run('insertUnorderedList');
    else if (current === 1) run('indent');
  };

  const moveOut = () => {
    if (level() > 0) run('outdent');
  };

  // The item where the cursor is, when it is empty.
  const emptyItem = () => {
    const selection = document.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed) return false;
    for (let n = selection.anchorNode; n && n !== ref.current; n = n.parentNode) {
      if (n.nodeName === 'LI') return n.textContent.trim() === '';
    }
    return false;
  };

  const onKeyDown = (event) => {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    // Ctrl+B and Ctrl+I everywhere (on a Mac, Ctrl+B would move the cursor), and Cmd on a Mac.
    if (mod && !event.altKey && (key === 'b' || key === 'i')) {
      event.preventDefault();
      run(key === 'b' ? 'bold' : 'italic');
      return;
    }
    if (mod && key === 'u') {
      event.preventDefault(); // no underline: a menu has only bold and italic
      return;
    }
    // Enter on an empty item goes up a level, and out of the list from an item.
    if (event.key === 'Enter' && !event.shiftKey && !mod && emptyItem()) {
      event.preventDefault();
      moveOut();
      return;
    }
    // Tab moves an item; outside a list it leaves the field, as usual.
    if (event.key === 'Tab' && !mod && level() > 0) {
      event.preventDefault();
      if (event.shiftKey) moveOut();
      else moveIn();
    }
  };

  const onPaste = (event) => {
    event.preventDefault();
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
  };

  const length = menuLength(text);
  const tooLong = length > MENU_MAX_LENGTH;

  return (
    <div className={`${styles.field} ${error ? styles.invalid : ''}`}>
      <span id={labelId} className={styles.label}>
        Menu
        <span className={styles.required} aria-hidden="true">
          {' '}
          *
        </span>
      </span>
      <div className={styles.box}>
        <div className={styles.toolbar} role="toolbar" aria-label="Format of the menu">
          <FormatButton label="Bold (Ctrl+B)" active={format.bold} onClick={() => run('bold')}>
            <span className={styles.bold}>B</span>
          </FormatButton>
          <FormatButton label="Italic (Ctrl+I)" active={format.italic} onClick={() => run('italic')}>
            <span className={styles.italic}>I</span>
          </FormatButton>
          <span className={styles.separator} aria-hidden="true" />
          <FormatButton label="List" active={format.level > 0} onClick={() => run('insertUnorderedList')}>
            <img src={format.level > 0 ? listActiveIcon : listIcon} width="20" height="20" alt="" />
          </FormatButton>
          <FormatButton label="Sub-item (Tab)" active={format.level === 2} onClick={moveIn}>
            <img src={format.level === 2 ? subItemActiveIcon : subItemIcon} width="20" height="20" alt="" />
          </FormatButton>
          <FormatButton label="Up a level (Shift+Tab)" active={false} onClick={moveOut}>
            <img src={upIcon} width="20" height="20" alt="" />
          </FormatButton>
          <span className={styles.hint}>Tab: sub-item · Shift+Tab: up a level</span>
        </div>
        <div className={styles.content}>
          {text === '' && (
            <p className={styles.placeholder} aria-hidden="true">
              Write the dishes, one per line.
            </p>
          )}
          <div
            ref={ref}
            className={styles.editable}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            aria-required="true"
            aria-labelledby={labelId}
            aria-invalid={error ? true : undefined}
            aria-describedby={noteId}
            spellCheck
            onFocus={() => document.execCommand('defaultParagraphSeparator', false, 'div')}
            onInput={changed}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onDrop={(event) => event.preventDefault()}
          />
        </div>
      </div>
      <div className={styles.footer}>
        {error && <p className={styles.error}>{error}</p>}
        <p id={noteId} className={`${styles.counter} ${tooLong ? styles.over : ''}`}>
          <span className={styles.visuallyHidden}>{error ? `${error} ` : ''}Characters: </span>
          {length} / {MENU_MAX_LENGTH}
        </p>
      </div>
    </div>
  );
}
