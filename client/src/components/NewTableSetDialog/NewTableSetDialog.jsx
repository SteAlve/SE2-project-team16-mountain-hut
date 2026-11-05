/**
 * "New table set" (mockup screens 5-6, P4-P5): a name and the tables, each with its number and
 * its seats. "Copy the tables of" fills the list from a set already made.
 * The tables are cells (Figma "Table row"): 3 per line on desktop, 1 on a phone. The last cell is
 * always empty, dashed, with the next number in grey: the seats typed there and Enter add the table
 * and open a new empty cell. "By size" counts the tables by seats.
 * The fields are checked here first (lib/tableSets.js); `onSave({ name, tables })` resolves to
 * { ok } or { ok: false, alert?, errors? } (e.g. the name already used). Mount it with a new `key` at every
 * opening.
 */
import { useRef, useState } from 'react';
import chevron from '../../assets/booking/chevron.svg';
import { bySize, hasErrors, nextTableNumber, seatsLabel, validateTableSet } from '../../lib/tableSets.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { Modal } from '../Modal/Modal.jsx';
import { TextField } from '../TextField/TextField.jsx';
import styles from './NewTableSetDialog.module.css';

const COLUMNS = 3;
const EMPTY_DRAFT = { tableNumber: '', capacity: '' };

// The number and the seats of one table, with the message of a wrong one right under it.
function CellField({ label, error, inputRef, ...inputProps }) {
  return (
    <div className={`${styles.cellField} ${error ? styles.invalid : ''}`}>
      <input
        ref={inputRef}
        className={styles.input}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        {...inputProps}
      />
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}

export function NewTableSetDialog({ open, tableSets, isPending, onSave, onCancel }) {
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [errors, setErrors] = useState({ rows: {} });
  const [checked, setChecked] = useState(false);
  const [alert, setAlert] = useState(null);
  const nextKey = useRef(0);
  const draftSeats = useRef(null);

  const withKeys = (tables) => tables.map((t) => ({ ...t, key: nextKey.current++ }));
  const next = nextTableNumber(rows);
  const typed = rows.filter((r) => r.capacity !== '' && !Number.isNaN(Number(r.capacity)));
  const seats = typed.reduce((sum, r) => sum + Number(r.capacity), 0);

  // After a first try the messages follow the typing.
  const update = (nextName, nextRows) => {
    setName(nextName);
    setRows(nextRows);
    if (checked) setErrors(validateTableSet({ name: nextName, tables: nextRows }));
  };

  const copy = (event) => {
    const id = event.target.value;
    setCopyFrom(id);
    if (!id) {
      update(name, []);
      setDraft(EMPTY_DRAFT);
      return;
    }
    const set = tableSets.find((s) => String(s.tableSetId) === id);
    if (set) {
      update(name, withKeys(set.tables.map((t) => ({ tableNumber: String(t.tableNumber), capacity: String(t.capacity) }))));
    }
  };

  const changeRow = (index, field) => (event) =>
    update(name, rows.map((r, i) => (i === index ? { ...r, [field]: event.target.value } : r)));

  const removeRow = (index) => update(name, rows.filter((_, i) => i !== index));

  // The empty cell becomes a table, and a new empty cell opens with the next number.
  const draftAsRow = () => ({ tableNumber: draft.tableNumber.trim() || String(next), capacity: draft.capacity.trim() });
  const addDraft = () => {
    if (!draft.capacity.trim()) return;
    update(name, [...rows, ...withKeys([draftAsRow()])]);
    setDraft(EMPTY_DRAFT);
    draftSeats.current?.focus();
  };

  const submit = async () => {
    // Seats typed in the empty cell without Enter still count as a table.
    const tables = draft.capacity.trim() ? [...rows, ...withKeys([draftAsRow()])] : rows;
    if (tables !== rows) {
      setRows(tables);
      setDraft(EMPTY_DRAFT);
    }
    const found = validateTableSet({ name, tables });
    setChecked(true);
    setErrors(found);
    setAlert(null);
    if (hasErrors(found)) return;
    const result = await onSave({
      name,
      tables: tables.map((t) => ({ tableNumber: Number(t.tableNumber), capacity: Number(t.capacity) })),
    });
    if (!result.ok) {
      setAlert(result.alert ?? null);
      setErrors({ ...found, ...result.errors });
    }
  };

  return (
    <Modal
      open={open}
      wide
      title="New table set"
      subtitle="The tables a slot can have, each with its number and its seats."
      titleId="new-table-set-title"
      isPending={isPending}
      onCancel={onCancel}
      onSubmit={submit}
      actions={
        <>
          <Button variant="outline" size="small" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="small" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save table set'}
          </Button>
        </>
      }
    >
      {alert && <Alert>{alert}</Alert>}

      <TextField
        label="Name"
        required
        value={name}
        error={errors.name}
        helper="Used to recognise the set when you give it to a slot."
        autoFocus
        onChange={(event) => update(event.target.value, rows)}
      />

      {tableSets.length > 0 && (
        <div className={styles.copy}>
          <label htmlFor="copy-tables-of" className={styles.label}>Copy the tables of</label>
          <div className={styles.selectWrap}>
            <select id="copy-tables-of" className={styles.select} value={copyFrom} onChange={copy}>
              <option value="">Don't copy</option>
              {tableSets.map((set) => (
                <option key={set.tableSetId} value={set.tableSetId}>{set.name}</option>
              ))}
            </select>
            <img src={chevron} alt="" width="20" height="20" className={styles.chevron} />
          </div>
          <p className={styles.helper}>Optional. Copies its tables here, then change only what differs.</p>
        </div>
      )}

      <div className={styles.tables} role="group" aria-labelledby="tables-label">
        <div className={styles.tablesHead}>
          <span id="tables-label" className={styles.label}>Tables</span>
          <span className={styles.total} aria-live="polite">
            {rows.length} {rows.length === 1 ? 'table' : 'tables'} · {seatsLabel(seats)}
          </span>
        </div>

        <div className={`${styles.grid} ${errors.tables ? styles.gridInvalid : ''}`}>
          {Array.from({ length: COLUMNS }, (_, i) => (
            <div key={i} className={styles.columns} aria-hidden="true">
              <span>Table</span>
              <span>Seats</span>
            </div>
          ))}

          {rows.map((row, i) => {
            const rowErrors = errors.rows?.[i] ?? {};
            const label = row.tableNumber || '?';
            return (
              <div key={row.key} className={styles.cell}>
                <CellField
                  label={`Number of table ${i + 1}`}
                  value={row.tableNumber}
                  error={rowErrors.tableNumber}
                  onChange={changeRow(i, 'tableNumber')}
                />
                <CellField
                  label={`Seats of table ${label}`}
                  value={row.capacity}
                  error={rowErrors.capacity}
                  onChange={changeRow(i, 'capacity')}
                />
                <button
                  type="button"
                  className={styles.icon}
                  aria-label={`Remove table ${label}`}
                  disabled={isPending}
                  onClick={() => removeRow(i)}
                >
                  ×
                </button>
              </div>
            );
          })}

          <div className={`${styles.cell} ${styles.draft}`}>
            <CellField
              label="Number of the new table"
              placeholder={String(next)}
              value={draft.tableNumber}
              onChange={(event) => setDraft({ ...draft, tableNumber: event.target.value })}
            />
            <CellField
              label={`Seats of table ${draft.tableNumber || next}`}
              placeholder="seats"
              value={draft.capacity}
              inputRef={draftSeats}
              onChange={(event) => setDraft({ ...draft, capacity: event.target.value })}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                addDraft();
              }}
            />
            <button type="button" className={styles.icon} aria-label="Add table" disabled={isPending} onClick={addDraft}>
              ↵
            </button>
          </div>
          <p className={styles.hint}>
            Type the seats of table {draft.tableNumber || next}: Enter ↵ adds it and opens the next cell.
          </p>
        </div>

        {errors.tables && <p className={styles.error}>{errors.tables}</p>}
        {typed.length > 0 && <p className={styles.bySize}>By size: {bySize(typed.map((r) => ({ capacity: Number(r.capacity) })))}</p>}
      </div>
    </Modal>
  );
}
