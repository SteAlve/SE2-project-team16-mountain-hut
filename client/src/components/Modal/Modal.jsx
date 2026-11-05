/**
 * The frame of the dialogs of the staff page: a dialog on desktop, a sheet from the bottom on a
 * phone, where the content scrolls and the buttons stay at the bottom, the main one first.
 * It is a <form>: the main button of `actions` is `type="submit"` and calls `onSubmit`.
 * Esc calls `onCancel`, unless `isPending`. The content stays mounted while closed, so a dialog
 * hidden under another one (e.g. Add a slot under New table set) keeps what was typed.
 * `extra` is the secondary action on the left of the buttons (e.g. "+ New table set").
 * `wide` is for New table set.
 */
import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';

export function Modal({ open, title, subtitle, titleId, wide = false, isPending, onCancel, onSubmit, actions, extra, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`${styles.dialog} ${wide ? styles.wide : ''}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending) onCancel();
      }}
    >
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!isPending) onSubmit();
        }}
      >
        <div className={styles.content}>
          <span className={styles.handle} aria-hidden="true" />
          <header className={styles.header}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </header>
          {children}
        </div>
        <div className={styles.actions}>
          {extra && <div className={styles.extra}>{extra}</div>}
          {actions}
        </div>
      </form>
    </dialog>
  );
}
