import { PartySeats } from '../PartySeats/PartySeats.jsx';
import { Button } from '../Button/Button.jsx';
import { Alert } from '../Alert/Alert.jsx';
import styles from './AvailabilityAnswer.module.css';

export function AvailabilityAnswer({ answer, partySize }) {
  if (!answer) return null;
  const { status, tables, freeSeats, label, error, message, latest } = answer;
  const unavailableMessage = message ?? (error?.status === 404
    ? 'This meal time is no longer available.'
    : error?.status === 422 && latest?.bookingOpen === false
      ? `Closed at ${latest.bookingClosesAt.slice(11, 16)}`
      : label?.startsWith('Closed') && error?.status === 422 && freeSeats > 0 ? label
        : freeSeats === 0 ? 'This time has no free seats.'
          : `This time has ${freeSeats} free seats, not enough for ${partySize} people.`);
  return (
    <div className={styles.answer} role="status" aria-label="Table availability" aria-live="polite">
      {status === 'loading' && <p>Checking availability…</p>}
      {status === 'error' && <p>Unable to check availability. Please try again.</p>}
      {status === 'choice' && <Alert variant="info">{message}</Alert>}
      {status === 'unavailable' && <>
        <strong className={styles.title}><span className={styles.no} aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor"><path d="m2 2 10 10M12 2 2 12" /></svg></span>Not available</strong>
        {message ? <Alert variant="info">{unavailableMessage}</Alert> : <p>{unavailableMessage}</p>}
      </>}
      {error && <Button size="small" variant="outline" onClick={answer.retry}>Check again</Button>}
      {status === 'available' && <>
        <strong className={styles.title}><span className={styles.yes} aria-hidden="true"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 4 4 8-9" /></svg></span>Available</strong>
        <PartySeats partySize={partySize} tables={tables} heading={`${tables.map(({ seats }) => seats).join(' + ')} seats`} />
      </>}
    </div>
  );
}
