/**
 * "Tables for 13:00 – 14:00" (mockup screen 8): gives one of the table sets to a slot without
 * tables. `onSave(tableSetId)` resolves to { ok }; on success the page closes it.
 * `onNewTableSet()` opens New table set over it; the set made there comes back as `createdSetId`
 * and is chosen. Mount it with a new `key` at every opening.
 */
import { useState } from 'react';
import { formatDay, formatTimeRange, yearOf } from '../../lib/bookingDates.js';
import { Button } from '../Button/Button.jsx';
import { Modal } from '../Modal/Modal.jsx';
import { TableSetOption } from '../TableSetOption/TableSetOption.jsx';
import styles from './ChooseTablesDialog.module.css';

export function ChooseTablesDialog({ open, slot, tableSets, createdSetId, isPending, onSave, onCancel, onNewTableSet }) {
  const [picked, setPicked] = useState(undefined);
  const [seenCreated, setSeenCreated] = useState(createdSetId);
  if (createdSetId !== seenCreated) {
    setSeenCreated(createdSetId);
    setPicked(createdSetId);
  }
  const tableSetId = picked ?? tableSets[0]?.tableSetId;

  return (
    <Modal
      open={open}
      title={`Tables for ${formatTimeRange(slot.startsAt, slot.endsAt)}`}
      subtitle={`${formatDay(slot.date)} ${yearOf(slot.date)}. Choose one of the table sets: hikers can book the slot as soon as it has tables.`}
      titleId="choose-tables-title"
      isPending={isPending}
      onCancel={onCancel}
      onSubmit={() => tableSetId !== undefined && onSave(tableSetId)}
      extra={
        <Button variant="ghost" size="small" disabled={isPending} onClick={onNewTableSet}>
          + New table set
        </Button>
      }
      actions={
        <>
          <Button variant="outline" size="small" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="small" disabled={isPending || tableSetId === undefined}>
            {isPending ? 'Saving…' : 'Give tables'}
          </Button>
        </>
      }
    >
      {tableSets.length > 0 ? (
        <div className={styles.options} role="radiogroup" aria-labelledby="choose-tables-title">
          {tableSets.map((set) => (
            <TableSetOption
              key={set.tableSetId}
              name="choose-table-set"
              tableSet={set}
              checked={tableSetId === set.tableSetId}
              onChange={() => setPicked(set.tableSetId)}
            />
          ))}
        </div>
      ) : (
        <p className={styles.hint}>No table sets yet. Make one with + New table set.</p>
      )}
    </Modal>
  );
}
