/**
 * "Menu" (mockup docs/mockups/menus, screen 6, phone 5): the whole menu of a slot, formatted as hikers
 * see it, with the slot under the title. A long menu scrolls inside its box.
 *   Edit menu (`onEdit`) opens Edit the menu; Close (`onClose`) goes back to the slots.
 *   Delete menu asks first, then `onDelete()`, which resolves to { ok } or { ok: false, alert? }.
 * The menu can be changed or deleted only until the slot starts (product owner, #59): once it has
 * started (`locked`) the dialog only shows it.
 * Mount it with a new `key` at every opening.
 */
import { useState } from 'react';
import { slotLabel } from '../../lib/staffSlots.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { MenuText } from '../MenuText/MenuText.jsx';
import { Modal } from '../Modal/Modal.jsx';
import styles from './ShowMenuDialog.module.css';

export function ShowMenuDialog({ open, slot, locked, isPending, onEdit, onDelete, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const [alert, setAlert] = useState(null);

  const remove = async () => {
    setAlert(null);
    const result = await onDelete();
    if (!result.ok && result.alert) setAlert(result.alert);
  };

  const submit = locked ? onClose : confirming ? remove : onEdit;

  let actions;
  if (locked) {
    actions = (
      <Button type="submit" variant="outline" size="small">
        Close
      </Button>
    );
  } else if (confirming) {
    actions = (
      <>
        <Button variant="outline" size="small" disabled={isPending} onClick={() => setConfirming(false)}>
          Keep the menu
        </Button>
        <Button type="submit" variant="danger" size="small" disabled={isPending}>
          {isPending ? 'Deleting…' : 'Delete menu'}
        </Button>
      </>
    );
  } else {
    actions = (
      <>
        <Button variant="outline" size="small" onClick={onClose}>
          Close
        </Button>
        <Button type="submit" size="small">
          Edit menu
        </Button>
      </>
    );
  }

  return (
    <Modal
      open={open}
      title="Menu"
      subtitle={slotLabel(slot)}
      titleId="show-menu-title"
      isPending={isPending}
      onCancel={onClose}
      onSubmit={submit}
      extra={
        !locked && !confirming && (
          <Button variant="ghost" size="small" className={styles.delete} onClick={() => setConfirming(true)}>
            Delete menu
          </Button>
        )
      }
      actions={actions}
    >
      {alert && <Alert>{alert}</Alert>}
      <div className={styles.box}>
        <MenuText menu={slot.menu} />
      </div>
      {locked && <Alert variant="info">This slot has started: its menu stays as it is.</Alert>}
      {confirming && (
        <Alert>
          Delete the menu of this slot? Hikers will see only the time. Other slots with the same menu keep theirs.
        </Alert>
      )}
    </Modal>
  );
}
