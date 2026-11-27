/**
 * "Start from a previous menu" (mockup docs/mockups/menus, screen 3, phone 3): the menus already
 * written for other slots, newest first, to copy one into the editor.
 * On the left each menu shows its slot and its first words (two lines); Search the menus finds a dish
 * or a day; Show older menus loads more. On the right the preview shows the chosen menu whole. On a
 * phone there is no room for two columns: the chosen menu opens inside its card.
 * `previous` is hooks/usePreviousMenus.js. `onUse(entry)` copies the chosen { slotId, date, startsAt,
 * endsAt, menu }; `onBack()` returns to the editor as it was.
 */
import { useState } from 'react';
import { menuSummary } from '../../lib/menuText.js';
import { slotLabel, slotWhen } from '../../lib/staffSlots.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { MenuText } from '../MenuText/MenuText.jsx';
import { Modal } from '../Modal/Modal.jsx';
import { TextField } from '../TextField/TextField.jsx';
import styles from './PreviousMenusDialog.module.css';

const GENERIC_ERROR = 'Something went wrong on our side. Try again in a minute.';

export function PreviousMenusDialog({ open, slot, previous, onUse, onBack }) {
  const { menus, hasMore, search, setSearch, query, showMore, failed } = previous;
  const [pickedId, setPickedId] = useState(null);
  const picked = menus?.find((m) => m.slotId === pickedId) ?? menus?.[0] ?? null;

  let list;
  if (menus === null) {
    list = failed ? null : <p className={styles.note}>Loading…</p>;
  } else if (menus.length === 0) {
    list = (
      <p className={styles.note}>
        {query ? `No menu has "${query}". Try a dish or a day.` : 'No menus written yet.'}
      </p>
    );
  } else {
    list = (
      <div className={styles.menus} role="radiogroup" aria-label="Previous menus">
        {menus.map((entry) => {
          const checked = entry.slotId === picked?.slotId;
          return (
            <label key={entry.slotId} className={`${styles.option} ${checked ? styles.checked : ''}`}>
              <input
                type="radio"
                name="previous-menu"
                className={styles.radio}
                checked={checked}
                onChange={() => setPickedId(entry.slotId)}
              />
              <span className={styles.text}>
                <span className={styles.when}>{slotWhen(entry)}</span>
                {checked ? (
                  <>
                    <span className={`${styles.summary} ${styles.desktopOnly}`}>{menuSummary(entry.menu)}</span>
                    <MenuText menu={entry.menu} className={styles.phoneOnly} />
                  </>
                ) : (
                  <span className={styles.summary}>{menuSummary(entry.menu)}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <Modal
      open={open}
      title="Start from a previous menu"
      subtitle={slotLabel(slot)}
      titleId="previous-menus-title"
      className={styles.dialog}
      onCancel={onBack}
      onSubmit={() => picked && onUse(picked)}
      extra={
        hasMore && (
          <Button variant="ghost" size="small" onClick={showMore}>
            Show older menus
          </Button>
        )
      }
      actions={
        <>
          <Button variant="outline" size="small" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" size="small" disabled={!picked}>
            Use this menu
          </Button>
        </>
      }
    >
      {failed && <Alert>{GENERIC_ERROR}</Alert>}
      <div className={styles.body}>
        <div className={styles.choose}>
          <TextField
            label="Search the menus"
            type="search"
            search
            placeholder="A dish or a day, e.g. polenta"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {list}
        </div>
        <section className={styles.preview} aria-label="Preview">
          {picked && (
            <>
              <div className={styles.previewHead}>
                <span className={styles.previewLabel}>Preview</span>
                <span className={styles.when}>{slotWhen(picked)}</span>
              </div>
              <MenuText menu={picked.menu} />
            </>
          )}
        </section>
      </div>
      <p className={styles.hint}>
        The menu you choose replaces what is in the editor. You can change it before saving.
      </p>
    </Modal>
  );
}
