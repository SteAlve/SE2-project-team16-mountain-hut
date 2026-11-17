/**
 * MY BOOKINGS (story MH-06, mockup docs/mockups/hiker-booking-page): the upcoming bookings of the hiker who is logged in,
 * from today on, not cancelled. Each one can be changed in a dialog (day, time, people, dietary needs) until 48 hours
 * before its time; after that Edit is faded and the line says when the changes closed. The server does the checks.
 * Cancel booking (story MH-08) is open at any time, also when Edit is faded: it asks to confirm, and the booking then leaves
 * the list. The navbar and Log out come from AppLayout.
 * Only hikers have bookings: the route is wrapped in RequireRole. If the session ends meanwhile (401), the login follows.
 */
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { BookingCard } from '../../components/BookingCard/BookingCard.jsx';
import { Button } from '../../components/Button/Button.jsx';
import { CancelBookingDialog } from '../../components/CancelBookingDialog/CancelBookingDialog.jsx';
import { ChangeBookingDialog } from '../../components/ChangeBookingDialog/ChangeBookingDialog.jsx';
import { useCancelBooking } from '../../hooks/useCancelBooking.js';
import { useChangeBooking } from '../../hooks/useChangeBooking.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useMyBookings } from '../../hooks/useMyBookings.js';
import styles from './MyBookingsPage.module.css';

// Sample data of the mockup, until the hut page story gives the real name and altitude.
const HUT_LABEL = 'Rifugio Alpe Lunga · 2.450 m';

const GOOD_TO_KNOW = [
  'You can change a booking until 48 hours before its time.',
  'You can only change to a time that starts at least 48 hours from now.',
  'You can cancel a booking at any time.',
  'Every change or cancellation is emailed to you.',
];

const LOGIN_STATE = { from: '/bookings', page: 'see your bookings' };

// The dialog is mounted only while a booking is edited, so every opening starts from the saved booking.
function ChangeBooking({ booking, list }) {
  const navigate = useNavigate();
  const change = useChangeBooking(booking, { onSaved: list.saved, onStale: list.stale, onRefresh: list.reload });

  const save = async () => {
    if ((await change.save()) === 'login') navigate('/login', { state: LOGIN_STATE });
  };

  return (
    <ChangeBookingDialog
      booking={booking}
      change={change}
      today={change.today}
      onClose={() => !change.isPending && list.closeEdit()}
      onSave={save}
    />
  );
}

// The same, for the confirmation of Cancel booking (MH-08).
function CancelBooking({ booking, list }) {
  const navigate = useNavigate();
  const cancel = useCancelBooking(booking, { onCancelled: list.cancelled, onStale: list.stale });

  const confirm = async () => {
    if ((await cancel.cancel()) === 'login') navigate('/login', { state: LOGIN_STATE });
  };

  return (
    <CancelBookingDialog
      booking={booking}
      pending={cancel.isPending}
      error={cancel.error}
      onKeep={list.closeCancel}
      onConfirm={confirm}
    />
  );
}

export function MyBookingsPage() {
  const navigate = useNavigate();
  const list = useMyBookings();
  const isPhone = useMediaQuery('(max-width: 991.98px)');

  if (list.loggedOut) return <Navigate to="/login" replace state={LOGIN_STATE} />;

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <div className={styles.main}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}>{HUT_LABEL}</p>
            <h1 className={styles.title}>My bookings</h1>
            <p className={styles.subtitle}>
              Your upcoming tables. Change a booking until 48 hours before it; cancel at any time.
            </p>
          </header>

          {list.notice && <Alert variant="info">{list.notice}</Alert>}
          {list.staleNote && <Alert>{list.staleNote}</Alert>}
          {list.alert && (
            <Alert>
              {list.alert}{' '}
              <button type="button" className={styles.retry} onClick={list.reload}>Try again</button>
            </Alert>
          )}

          {list.isLoading && <p className={styles.hint}>Loading your bookings…</p>}

          {list.bookings?.length === 0 && (
            <section className={styles.empty}>
              <h2 className={styles.emptyTitle}>No upcoming bookings.</h2>
              <p className={styles.hint}>
                Tables you book will appear here, from today on. Cancelled and past bookings are not listed.
              </p>
              <Button size="small" className={styles.bookButton} onClick={() => navigate('/book')}>
                Book a table
              </Button>
            </section>
          )}

          {list.bookings?.length > 0 && (
            <ul className={styles.list} aria-label="Your bookings">
              {list.bookings.map((booking) => (
                <BookingCard key={booking.id} booking={booking} isPhone={isPhone} onEdit={list.edit} onCancel={list.cancel} />
              ))}
            </ul>
          )}
        </div>

        <aside className={styles.know} aria-labelledby="good-to-know">
          <h2 id="good-to-know" className={styles.knowTitle}>Good to know</h2>
          <ul className={styles.knowList}>
            {GOOD_TO_KNOW.map((text) => (
              <li key={text} className={styles.knowItem}>
                <span className={styles.blaze} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </aside>
      </main>

      {list.editing && <ChangeBooking key={list.editing.id} booking={list.editing} list={list} />}
      {list.cancelling && <CancelBooking key={list.cancelling.id} booking={list.cancelling} list={list} />}
    </div>
  );
}
