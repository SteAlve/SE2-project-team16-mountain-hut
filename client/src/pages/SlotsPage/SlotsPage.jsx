/**
 * SLOTS & TABLES (story MH-02, mockup docs/mockups/slots): the staff page where the employee or the
 * warden adds the meal slots of each day and gives each one its table set.
 * The data comes from the staff endpoints (hooks/useSlotsTables.js); a 401 sends to the login,
 * and back here after it.
 * Dialogs: Add a slot, Choose tables (a slot without tables) and New table set, which opens over
 * the first two or from the Table sets card; the set saved there is chosen in the dialog it came from.
 * The navbar and Log out come from AppLayout; RequireRole keeps hikers and visitors out.
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AddSlotDialog } from '../../components/AddSlotDialog/AddSlotDialog.jsx';
import { Alert } from '../../components/Alert/Alert.jsx';
import { Button } from '../../components/Button/Button.jsx';
import { ChooseTablesDialog } from '../../components/ChooseTablesDialog/ChooseTablesDialog.jsx';
import { DayStrip } from '../../components/DayStrip/DayStrip.jsx';
import { NewTableSetDialog } from '../../components/NewTableSetDialog/NewTableSetDialog.jsx';
import { SlotRow } from '../../components/SlotRow/SlotRow.jsx';
import { TableSetsCard } from '../../components/TableSetsCard/TableSetsCard.jsx';
import { useSlotsTables } from '../../hooks/useSlotsTables.js';
import { formatDay, toDay } from '../../lib/bookingDates.js';
import { seatsLabel } from '../../lib/tableSets.js';
import styles from './SlotsPage.module.css';

// Sample data of the mockup, until the hut page story gives the real name and altitude.
const HUT_LABEL = 'Rifugio Alpe Lunga · 2.450 m';

export function SlotsPage() {
  const page = useSlotsTables();
  const { date, slots } = page;
  // Each dialog gets a new key at every opening, so it starts empty.
  const [opened, setOpened] = useState(0);
  const [addSlot, setAddSlot] = useState(null); // { key }
  const [choose, setChoose] = useState(null); // { key, slot }
  const [newSet, setNewSet] = useState(null); // { key, from: 'addSlot' | 'choose' | 'card' }
  const [createdSetId, setCreatedSetId] = useState(undefined);

  const open = (setter, value = {}) => {
    setOpened((n) => n + 1);
    setCreatedSetId(undefined);
    setter({ key: opened, ...value });
  };

  const saveSlot = async (form) => {
    const result = await page.addSlot(form);
    if (result.ok) setAddSlot(null);
    return result;
  };

  const saveTables = async (tableSetId) => {
    const result = await page.assignTableSet(choose.slot.slotId, tableSetId);
    // A failure (the slot already has tables, or is gone) closes it too: the alert is on the page.
    setChoose(null);
    return result;
  };

  const saveTableSet = async (form) => {
    const result = await page.createTableSet(form);
    if (result.ok) {
      setCreatedSetId(result.tableSet.tableSetId);
      setNewSet(null);
    }
    return result;
  };

  const openNewSet = (from) => {
    setOpened((n) => n + 1);
    setNewSet({ key: opened, from });
  };

  if (page.needsLogin) {
    return <Navigate to="/login" replace state={{ from: '/slots', page: 'see the slots and tables' }} />;
  }

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <div className={styles.day}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}>{HUT_LABEL}</p>
            <h1 className={styles.title}>Slots &amp; tables</h1>
            <p className={styles.subtitle}>
              Add the meal slots of each day and give each one its tables. Hikers can book only a slot that has tables.
            </p>
          </header>

          {page.alert && <Alert>{page.alert}</Alert>}
          {page.notice && <Alert variant="info">{page.notice}</Alert>}

          <DayStrip
            days={page.days}
            selected={date}
            today={toDay(new Date())}
            onSelect={page.chooseDate}
            onReachEnd={page.showMoreDays}
            labelledBy="day-title"
            pickEmpty
          />

          <div className={styles.dayHead}>
            <h2 id="day-title" className={styles.dayTitle}>
              {formatDay(date)}
              {slots?.length > 0 && (
                <span className={styles.daySummary}>
                  {slots.length} {slots.length === 1 ? 'slot' : 'slots'} · {seatsLabel(page.totalSeats)}
                </span>
              )}
            </h2>
            <Button size="small" className={styles.addTop} onClick={() => open(setAddSlot)}>
              + Add a slot
            </Button>
          </div>

          {slots === null ? (
            !page.alert && <p className={styles.loading}>Loading…</p>
          ) : slots.length > 0 ? (
            <ul className={styles.slots} aria-labelledby="day-title">
              {slots.map((slot) => (
                <SlotRow key={slot.slotId} slot={slot} onChooseTables={() => open(setChoose, { slot })} />
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No slots on {formatDay(date)}.</p>
              <p className={styles.emptyText}>Hikers cannot book this day. Add a slot and give it its tables.</p>
              <Button variant="outline" size="small" onClick={() => open(setAddSlot)}>
                + Add a slot
              </Button>
            </div>
          )}
        </div>

        <TableSetsCard tableSets={page.tableSets} onNew={() => openNewSet('card')} />
      </main>

      <div className={styles.bar}>
        <Button block onClick={() => open(setAddSlot)}>
          + Add a slot
        </Button>
      </div>

      {addSlot && (
        <AddSlotDialog
          key={addSlot.key}
          open={!newSet}
          date={date}
          tableSets={page.tableSets}
          createdSetId={createdSetId}
          isPending={page.isPending}
          onSave={saveSlot}
          onCancel={() => setAddSlot(null)}
          onNewTableSet={() => openNewSet('addSlot')}
        />
      )}

      {choose && (
        <ChooseTablesDialog
          key={choose.key}
          open={!newSet}
          slot={choose.slot}
          tableSets={page.tableSets}
          createdSetId={createdSetId}
          isPending={page.isPending}
          onSave={saveTables}
          onCancel={() => setChoose(null)}
          onNewTableSet={() => openNewSet('choose')}
        />
      )}

      {newSet && (
        <NewTableSetDialog
          key={newSet.key}
          open
          tableSets={page.tableSets}
          isPending={page.isPending}
          onSave={saveTableSet}
          onCancel={() => setNewSet(null)}
        />
      )}
    </div>
  );
}
