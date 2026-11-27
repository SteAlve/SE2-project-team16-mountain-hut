/**
 * "Write the menu" / "Edit the menu" (mockup docs/mockups/menus, screens 2, 4, 7, 8, 12): the menu of a
 * slot in the editor, with the slot under the title.
 *   - Write, with previous menus: the box "Start from a previous menu" (`onChoosePrevious`).
 *   - A menu copied from a previous one (`copied`: { menu, slot }) replaces the text, with an info
 *     alert; "Start from a previous menu" moves to the bottom left (on a phone, under the editor).
 *   - Edit: the current menu (`initialMenu`), and "Start from a previous menu" at the bottom left.
 *   - Just after Add a slot (`justAdded`): an info alert says the slot was added, and Cancel is
 *     "Skip for now" (the slot stays without a menu).
 * Save menu checks the menu first (lib/menuText.js, checkMenu), then `onSave(text)`, which resolves to
 * { ok } or { ok: false, error?, alert? }; on success the page closes it.
 * Mount it with a new `key` at every opening; `open` false hides it under Start from a previous menu.
 */
import { useState } from 'react';
import { checkMenu } from '../../lib/menuText.js';
import { slotLabel, slotWhen } from '../../lib/staffSlots.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { MenuEditor } from '../MenuEditor/MenuEditor.jsx';
import { Modal } from '../Modal/Modal.jsx';
import styles from './MenuDialog.module.css';

export function MenuDialog({
  open, slot, editing, justAdded = false, initialMenu = '', copied, hasPrevious, isPending, onChoosePrevious, onSave, onCancel,
}) {
  const [text, setText] = useState(initialMenu);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  // A copied menu replaces what is in the editor: the editor starts again with it.
  const [seenCopy, setSeenCopy] = useState(copied);
  const [editorKey, setEditorKey] = useState(0);
  if (copied !== seenCopy) {
    setSeenCopy(copied);
    if (copied) {
      setText(copied.menu);
      setError(null);
      setEditorKey((key) => key + 1);
    }
  }

  const change = (menu) => {
    setText(menu);
    setError(null);
  };

  const save = async () => {
    const message = checkMenu(text);
    if (message) {
      setError(message);
      return;
    }
    setAlert(null);
    const result = await onSave(text);
    if (!result.ok) {
      if (result.error) setError(result.error);
      if (result.alert) setAlert(result.alert);
    }
  };

  const showBox = !editing && !copied && hasPrevious;
  const showLink = (editing || copied) && hasPrevious;

  return (
    <Modal
      open={open}
      title={editing ? 'Edit the menu' : 'Write the menu'}
      subtitle={slotLabel(slot)}
      titleId="menu-dialog-title"
      isPending={isPending}
      onCancel={onCancel}
      onSubmit={save}
      extra={
        showLink && (
          <Button variant="ghost" size="small" className={styles.desktopOnly} disabled={isPending} onClick={onChoosePrevious}>
            Start from a previous menu
          </Button>
        )
      }
      actions={
        <>
          <Button variant="outline" size="small" disabled={isPending} onClick={onCancel}>
            {justAdded ? 'Skip for now' : 'Cancel'}
          </Button>
          <Button type="submit" size="small" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save menu'}
          </Button>
        </>
      }
    >
      {alert && <Alert>{alert}</Alert>}
      {justAdded && !copied && (
        <Alert variant="info">Slot added. Write its menu now, or skip and write it later from the slot.</Alert>
      )}
      {copied && (
        <Alert variant="info">
          Copied from {slotWhen(copied.slot).replace(' · ', ', ')}. Changing it here does not change that menu.
        </Alert>
      )}
      {showBox && (
        <div className={styles.previous}>
          <div className={styles.previousText}>
            <span className={styles.previousTitle}>Start from a previous menu</span>
            <span className={styles.previousHint}>Copy a menu you already wrote, then change what is different.</span>
          </div>
          <Button variant="outline" size="small" disabled={isPending} onClick={onChoosePrevious}>
            Choose a menu
          </Button>
        </div>
      )}
      <MenuEditor key={editorKey} initialValue={copied?.menu ?? initialMenu} error={error} onChange={change} />
      {showLink && (
        <Button variant="outline" size="small" block className={styles.phoneOnly} disabled={isPending} onClick={onChoosePrevious}>
          Start from a previous menu
        </Button>
      )}
    </Modal>
  );
}
