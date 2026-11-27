/**
 * SLOTS & TABLES (story MH-02, mockup docs/mockups/slots): the staff page where the employee or the
 * warden adds the meal slots of each day and gives each one its table set.
 * The data comes from the staff endpoints (hooks/useSlotsTables.js); a 401 sends to the login,
 * and back here after it.
 * Dialogs: Add a slot, Choose tables (a slot without tables) and New table set, which opens over
 * the first two or from the Table sets card; the set saved there is chosen in the dialog it came from.
 * The menus (MH-10, mockup docs/mockups/menus): each slot shows its menu; Show menu opens it (with
 * Edit menu and Delete menu), Write the menu opens the editor, and Start from a previous menu opens
 * over the editor and copies the chosen menu into it. A slot that has started keeps its menu as it is.
 * A slot just saved in Add a slot goes straight on to Write the menu (screen 12), where Skip for now leaves it
 * without a menu (it can be written later from the slot).
 * The navbar and Log out come from AppLayout; RequireRole keeps hikers and visitors out.
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AddSlotDialog } from '../../components/AddSlotDialog/AddSlotDialog.jsx';
import { Alert } from '../../components/Alert/Alert.jsx';
import { Button } from '../../components/Button/Button.jsx';
import { ChooseTablesDialog } from '../../components/ChooseTablesDialog/ChooseTablesDialog.jsx';
import { CopyWeekDialog } from '../../components/CopyWeekDialog/CopyWeekDialog.jsx';
import { DayStrip } from '../../components/DayStrip/DayStrip.jsx';
import { MenuDialog } from '../../components/MenuDialog/MenuDialog.jsx';
import { NewTableSetDialog } from '../../components/NewTableSetDialog/NewTableSetDialog.jsx';
import { PreviousMenusDialog } from '../../components/PreviousMenusDialog/PreviousMenusDialog.jsx';
import { ShowMenuDialog } from '../../components/ShowMenuDialog/ShowMenuDialog.jsx';
import { SlotRow } from '../../components/SlotRow/SlotRow.jsx';
import { TableSetsCard } from '../../components/TableSetsCard/TableSetsCard.jsx';
import { useCopyWeeklySchedule } from '../../hooks/useCopyWeeklySchedule.js';
import { usePreviousMenus } from '../../hooks/usePreviousMenus.js';
import { useSlotsTables } from '../../hooks/useSlotsTables.js';
import { formatDay, nextDays, toDay } from '../../lib/bookingDates.js';
import { hasStarted } from '../../lib/staffSlots.js';
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
  const [copyWeek, setCopyWeek] = useState(false);
  const [copyNotice, setCopyNotice] = useState(null);
  const [showMenu, setShowMenu] = useState(null); // { key, slot }
  const [editMenu, setEditMenu] = useState(null); // { key, slot, editing, justAdded, copied: { menu, slot } | null }
  const [choosingMenu, setChoosingMenu] = useState(false);
  const previousMenus = usePreviousMenus({
    exceptSlotId: editMenu?.slot.slotId ?? null,
    enabled: editMenu !== null,
    onNeedsLogin: page.markNeedsLogin,
  });
  const copySchedule = useCopyWeeklySchedule({
    sourceStart: date,
    onNeedsLogin: page.markNeedsLogin,
    enabled: copyWeek,
  });

  const open = (setter, value = {}) => {
    setOpened((n) => n + 1);
    setCreatedSetId(undefined);
    setter({ key: opened, ...value });
  };

  // A slot just added goes on to Write the menu, which can be skipped; a slot that has already
  // started cannot have a menu, so it stops here.
  const saveSlot = async (form) => {
    const result = await page.addSlot(form);
    if (result.ok) {
      setAddSlot(null);
      if (!menuLocked(result.slot)) openEditor(result.slot, false, true);
    }
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

  // The menus (MH-10). The browser's clock is the hut's: the staff work at the hut (lib/staffSlots.js).
  const now = new Date();
  const menuLocked = (slot) => hasStarted(slot.date, slot.startsAt, now);

  const openEditor = (slot, editing, justAdded = false) => {
    setShowMenu(null);
    previousMenus.setSearch('');
    open(setEditMenu, { slot, editing, justAdded, copied: null });
  };

  const saveMenu = async (text) => {
    const result = await page.saveMenu(editMenu.slot, text);
    if (result.ok || result.closed) setEditMenu(null);
    return result;
  };

  const deleteMenu = async () => {
    const result = await page.deleteMenu(showMenu.slot);
    if (result.ok || result.closed) setShowMenu(null);
    return result;
  };

  const usePrevious = (entry) => {
    setEditMenu((current) => ({ ...current, copied: { menu: entry.menu, slot: entry } }));
    setChoosingMenu(false);
  };

  const chooseDate = (day) => {
    setCopyNotice(null);
    page.chooseDate(day);
  };

  const sourcePeriod = nextDays(date, 7);
  const closeCopyWeek = () => {
    copySchedule.reset();
    setCopyWeek(false);
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
          {copyNotice && <Alert variant="info">{copyNotice}</Alert>}

          <DayStrip
            days={page.days}
            selected={date}
            today={toDay(new Date())}
            onSelect={chooseDate}
            onReachEnd={page.showMoreDays}
            labelledBy="day-title"
            pickEmpty
          />

          <div className={styles.weekLine}>
            <div>
              <span className={styles.weekLabel}>Selected period</span>
              <strong>{formatDay(sourcePeriod[0])} – {formatDay(sourcePeriod[6])}</strong>
            </div>
            <Button
              variant="outline"
              size="small"
              disabled={slots === null}
              onClick={() => setCopyWeek(true)}
            >
              Copy this week
            </Button>
          </div>

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
                <SlotRow
                  key={slot.slotId}
                  slot={slot}
                  menuLocked={menuLocked(slot)}
                  onChooseTables={() => open(setChoose, { slot })}
                  onShowMenu={() => open(setShowMenu, { slot })}
                  onWriteMenu={() => openEditor(slot, false)}
                />
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

      {showMenu && (
        <ShowMenuDialog
          key={showMenu.key}
          open
          slot={showMenu.slot}
          locked={menuLocked(showMenu.slot)}
          isPending={page.isPending}
          onEdit={() => openEditor(showMenu.slot, true)}
          onDelete={deleteMenu}
          onClose={() => setShowMenu(null)}
        />
      )}

      {editMenu && (
        <MenuDialog
          key={editMenu.key}
          open={!choosingMenu}
          slot={editMenu.slot}
          editing={editMenu.editing}
          justAdded={editMenu.justAdded}
          initialMenu={editMenu.slot.menu ?? ''}
          copied={editMenu.copied}
          hasPrevious={previousMenus.hasAny === true}
          isPending={page.isPending}
          onChoosePrevious={() => setChoosingMenu(true)}
          onSave={saveMenu}
          onCancel={() => setEditMenu(null)}
        />
      )}

      {editMenu && choosingMenu && (
        <PreviousMenusDialog
          open
          slot={editMenu.slot}
          previous={previousMenus}
          onUse={usePrevious}
          onBack={() => setChoosingMenu(false)}
        />
      )}

      {copyWeek && (
        <CopyWeekDialog
          key={date}
          open
          {...copySchedule}
          onToggle={copySchedule.toggle}
          onShowMore={copySchedule.showMore}
          onCopy={copySchedule.copy}
          onCancel={closeCopyWeek}
          onCopied={({ selectedPeriods }) => {
            closeCopyWeek();
            page.reload();
            setCopyNotice(`Copied ${formatDay(date)} – ${formatDay(sourcePeriod[6])} to ${selectedPeriods.length} continuation period${selectedPeriods.length === 1 ? '' : 's'}.`);
          }}
        />
      )}
    </div>
  );
}
