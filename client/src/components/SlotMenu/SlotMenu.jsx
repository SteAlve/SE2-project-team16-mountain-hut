/**
 * The menu line at the bottom of a slot on Slots & tables (Figma "Slot menu", MH-10).
 *   with a menu: its first words on one line, and Show menu (`onShow`);
 *   with none:   "No menu yet. Hikers see only the time." and Write the menu (`onWrite`).
 * Once the slot has started (`locked`) its menu stays as it is (product owner, #59): it can still be
 * read, but a slot with no menu gets none.
 * On a phone the label and the button are on top, the first words under them.
 */
import { menuSummary } from '../../lib/menuText.js';
import { Button } from '../Button/Button.jsx';
import styles from './SlotMenu.module.css';

export function SlotMenu({ menu, locked, onShow, onWrite }) {
  return (
    <div className={styles.line}>
      <span className={styles.label}>Menu</span>
      {menu ? (
        <>
          <p className={styles.summary}>{menuSummary(menu)}</p>
          <Button variant="outline" size="small" className={styles.action} onClick={onShow}>
            Show menu
          </Button>
        </>
      ) : locked ? (
        <p className={styles.empty}>No menu. The slot has started, so it can no longer get one.</p>
      ) : (
        <>
          <p className={styles.empty}>No menu yet. Hikers see only the time.</p>
          <Button variant="outline" size="small" className={styles.action} onClick={onWrite}>
            Write the menu
          </Button>
        </>
      )}
    </div>
  );
}
