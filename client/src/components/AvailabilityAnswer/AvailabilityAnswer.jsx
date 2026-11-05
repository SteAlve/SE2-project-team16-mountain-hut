import { PartySeats } from '../PartySeats/PartySeats.jsx';
import { Button } from '../Button/Button.jsx';
import { Alert } from '../Alert/Alert.jsx';
import { unavailableMessage } from '../../lib/availabilityMessage.js';
import styles from './AvailabilityAnswer.module.css';

export function AvailabilityAnswer({ answer, partySize }) {
  if (!answer) return null;
  const { status, tables, message } = answer;
  return (
    <div className={styles.answer} role="status" aria-label="Table availability" aria-live="polite" aria-busy={Boolean(answer.isRefreshing)}>
      {status === 'loading' && <>
        <strong className={`${styles.title} ${styles.statusTitle}`}><span className={styles.loadingIcon} aria-hidden="true" />Checking…</strong>
        <div className={styles.seatsPlaceholder} aria-hidden="true">
          <span className={styles.placeholderHeading} />
          <span className={styles.placeholderSeats}><i /><i /><i /></span>
          <span className={styles.placeholderDetail} />
        </div>
      </>}
      {status === 'error' && <p>Unable to check availability. Please try again.</p>}
      {status === 'choice' && <Alert variant="info">{message}</Alert>}
      {status === 'unavailable' && <>
        <strong className={styles.title}><span className={styles.no} aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><path d="m2 2 10 10M12 2 2 12" /></svg></span>Not available</strong>
        {message ? <Alert variant="info">{unavailableMessage(answer, partySize)}</Alert> : <p>{unavailableMessage(answer, partySize)}</p>}
      </>}
      {status === 'error' && <Button size="small" variant="outline" onClick={answer.retry}>Check again</Button>}
      {answer.isRefreshing && <p>Updating availability…</p>}
      {status === 'available' && <>
        <strong className={`${styles.title} ${styles.statusTitle}`}><span className={styles.yes} aria-hidden="true"><svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 4 4 8-9" /></svg></span>Available</strong>
        <PartySeats partySize={partySize} tables={tables} heading={`${tables.map(({ seats }) => seats).join(' + ')} seats`} />
      </>}
    </div>
  );
}
