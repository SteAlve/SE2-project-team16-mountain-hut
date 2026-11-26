/**
 * Confirmation of a full-profile hiker account (MH-07). The password is shown only while this
 * dialog is open; closing it clears the one-time value from the reservation state.
 */
import { hikerName } from '../../lib/hikers.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { Modal } from '../Modal/Modal.jsx';
import styles from './HikerAccountCreatedDialog.module.css';

export function HikerAccountCreatedDialog({ hiker, password, onClose }) {
  return (
    <Modal
      open
      title="Hiker account created"
      titleId="hiker-account-created-title"
      subtitle={`${hikerName(hiker)} can now log in with the email and password below.`}
      onCancel={onClose}
      onSubmit={onClose}
      actions={
        <Button type="submit" size="small" autoFocus>
          Continue
        </Button>
      }
    >
      <dl className={styles.details}>
        <div className={styles.row}>
          <dt>Email</dt>
          <dd>{hiker.email}</dd>
        </div>
        <div className={styles.row}>
          <dt>Generated password</dt>
          <dd className={styles.password}>{password}</dd>
        </div>
      </dl>

      <Alert variant="info">
        The password was also sent to {hiker.email}. The hiker must change it at their first login.
      </Alert>
    </Modal>
  );
}
