/**
 * "New hiker" (MH-07, mockup screens 4-6 and 9, phone screen 2): a hiker not found by the search.
 * The switch (Figma "Hiker mode") chooses how:
 *   Quick entry   first name, last name and an optional phone: a temporary hiker, who cannot log in
 *   Full profile  the same and an email: a hiker account; the server emails the password to the
 *                 hiker, the employee never sees it
 * The fields are checked here first (lib/hikers.js). `onSave(form)` resolves to { ok } or
 * { ok: false, errors?, alert?, owner? }: `owner` is the hiker who already has that email, and the
 * "Choose <name>" button calls `onChoose(owner)`. Mount it with a new `key` at every opening.
 */
import { useState } from 'react';
import { HIKER_MODES, hikerName, validateNewHiker } from '../../lib/hikers.js';
import { hasErrors } from '../../lib/validateAuthForms.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { Modal } from '../Modal/Modal.jsx';
import { TextField } from '../TextField/TextField.jsx';
import styles from './NewHikerDialog.module.css';

const MODES = [
  [HIKER_MODES.QUICK, 'Quick entry'],
  [HIKER_MODES.FULL, 'Full profile'],
];

const EMPTY = { mode: HIKER_MODES.QUICK, firstName: '', lastName: '', email: '', phone: '' };

export function NewHikerDialog({ open, isPending, onSave, onChoose, onCancel }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [checked, setChecked] = useState(false);
  // What the server said about the email typed (409), until it changes.
  const [conflict, setConflict] = useState(null); // { message, alert?, owner? }
  const [alert, setAlert] = useState(null);
  const isFull = form.mode === HIKER_MODES.FULL;

  // After a first try the messages follow the typing.
  const update = (field) => (value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (field === 'email' || field === 'mode') setConflict(null);
    if (checked) setErrors(validateNewHiker(next));
  };
  const onInput = (field) => (event) => update(field)(event.target.value);

  const submit = async () => {
    const found = validateNewHiker(form);
    setChecked(true);
    setErrors(found);
    setAlert(null);
    setConflict(null);
    if (hasErrors(found)) return;
    const result = await onSave(form);
    if (result.ok) return;
    if (result.errors?.email) {
      setConflict({ message: result.errors.email, alert: result.alert, owner: result.owner });
    } else {
      setAlert(result.alert ?? null);
    }
  };

  const shown = { ...errors, ...(conflict && { email: conflict.message }) };
  const errorAlert = alert ?? conflict?.alert;
  const owner = conflict?.owner;

  return (
    <Modal
      open={open}
      title="New hiker"
      subtitle="Not found by the search. Add the hiker to enter the reservation; they are chosen as soon as they are saved."
      titleId="new-hiker-title"
      isPending={isPending}
      onCancel={onCancel}
      onSubmit={submit}
      extra={owner && (
        <Button variant="ghost" size="small" disabled={isPending} onClick={() => onChoose(owner)}>
          Choose {hikerName(owner)}
        </Button>
      )}
      actions={
        <>
          <Button variant="outline" size="small" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="small" disabled={isPending}>
            {isPending ? 'Adding…' : 'Add hiker'}
          </Button>
        </>
      }
    >
      <div className={styles.modes} role="radiogroup" aria-label="How to add the hiker">
        {MODES.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={form.mode === mode}
            className={`${styles.mode} ${form.mode === mode ? styles.on : ''}`}
            disabled={isPending}
            onClick={() => update('mode')(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.names}>
        <TextField
          label="First name"
          required
          autoComplete="off"
          autoFocus
          value={form.firstName}
          error={shown.firstName}
          onChange={onInput('firstName')}
        />
        <TextField
          label="Last name"
          required
          autoComplete="off"
          value={form.lastName}
          error={shown.lastName}
          onChange={onInput('lastName')}
        />
      </div>

      {isFull && (
        <TextField
          label="Email"
          required
          type="email"
          autoComplete="off"
          value={form.email}
          error={shown.email}
          helper="For the login and to recover the password."
          onChange={onInput('email')}
        />
      )}

      <TextField
        label="Phone"
        type="tel"
        autoComplete="off"
        value={form.phone}
        error={shown.phone}
        helper={isFull ? undefined : 'Optional. To reach the party if needed.'}
        onChange={onInput('phone')}
      />

      {errorAlert ? (
        <Alert>{errorAlert}</Alert>
      ) : (
        !conflict && (
          <Alert variant="info">
            {isFull
              ? 'We email a password to the hiker as soon as you add them. They must change it at their first login, and can always recover it by email.'
              : 'A temporary hiker cannot log in or use the website. Only the staff can enter their reservations.'}
          </Alert>
        )
      )}
    </Modal>
  );
}
