/**
 * "Add a slot" (mockup screens 3-4, P2-P3): the day, the start and the end, and one of the table
 * sets or "No tables for now". The fields are checked here first (lib/tableSets.js).
 * `onSave(form)` resolves to { ok } or { ok: false, alert?, errors? }: the dialog shows them and
 * keeps the other choices. `onNewTableSet()` opens New table set over it; when that set is saved
 * the page passes it back as `createdSetId`, and it is chosen here.
 * Mount it with a new `key` at every opening, so it starts empty on `date`.
 */
import { useState } from 'react';
import { hasErrors, validateSlot } from '../../lib/tableSets.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { Modal } from '../Modal/Modal.jsx';
import { TableSetOption } from '../TableSetOption/TableSetOption.jsx';
import { TextField } from '../TextField/TextField.jsx';
import styles from './AddSlotDialog.module.css';

export function AddSlotDialog({ open, date, tableSets, createdSetId, isPending, onSave, onCancel, onNewTableSet }) {
  const [form, setForm] = useState({ date, startsAt: '', endsAt: '' });
  // null is "No tables for now"; undefined until the employee picks one.
  const [picked, setPicked] = useState(undefined);
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState(null);
  const [checked, setChecked] = useState(false);

  // A set just made from here is chosen.
  const [seenCreated, setSeenCreated] = useState(createdSetId);
  if (createdSetId !== seenCreated) {
    setSeenCreated(createdSetId);
    setPicked(createdSetId);
  }
  // Until one is picked: the first set, or none without sets.
  const tableSetId = picked !== undefined ? picked : (tableSets[0]?.tableSetId ?? null);

  const change = (field) => (event) => {
    const next = { ...form, [field]: event.target.value };
    setForm(next);
    // After a first try the messages follow the typing; an "Already used." goes with a new value.
    if (checked) setErrors(validateSlot(next));
  };

  const submit = async () => {
    const found = validateSlot(form);
    setChecked(true);
    setErrors(found);
    setAlert(null);
    if (hasErrors(found)) return;
    const result = await onSave({ ...form, tableSetId });
    if (!result.ok) {
      setAlert(result.alert ?? null);
      setErrors(result.errors ?? {});
    }
  };

  return (
    <Modal
      open={open}
      title="Add a slot"
      titleId="add-slot-title"
      isPending={isPending}
      onCancel={onCancel}
      onSubmit={submit}
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
          <Button type="submit" size="small" disabled={isPending}>
            {isPending ? 'Saving…' : 'Add slot'}
          </Button>
        </>
      }
    >
      {alert && <Alert>{alert}</Alert>}

      <div className={styles.when}>
        <div className={styles.day}>
          <TextField label="Day" required type="date" value={form.date} error={errors.date} onChange={change('date')} />
        </div>
        <TextField
          label="Starts at"
          required
          type="time"
          value={form.startsAt}
          error={errors.startsAt}
          onChange={change('startsAt')}
        />
        <TextField label="Ends at" required type="time" value={form.endsAt} error={errors.endsAt} onChange={change('endsAt')} />
      </div>

      <fieldset className={styles.tables}>
        <legend className={styles.legend}>Tables</legend>
        <p className={styles.hint}>
          {tableSets.length > 0
            ? 'Choose one of the table sets: its tables are not entered again.'
            : 'No table sets yet. Make one with + New table set, or add the slot now and give it its tables later.'}
        </p>
        <div className={styles.options}>
          {tableSets.map((set) => (
            <TableSetOption
              key={set.tableSetId}
              name="add-slot-table-set"
              tableSet={set}
              checked={tableSetId === set.tableSetId}
              onChange={() => setPicked(set.tableSetId)}
            />
          ))}
          <TableSetOption name="add-slot-table-set" checked={tableSetId === null} onChange={() => setPicked(null)} />
        </div>
      </fieldset>
    </Modal>
  );
}
