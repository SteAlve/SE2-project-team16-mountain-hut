/**
 * BOOK A TABLE (story MH-01, mockup docs/mockups/booking): the hiker chooses the day, how many
 * they are and a time, checks the booking and confirms it.
 * The availability is public; booking needs a logged-in hiker. A visitor who is not logged in is
 * sent to the login with `state: { from, page }`, and the choices travel in the URL of `from`
 * (?date=&people=&slot=), so they are still there after the login.
 */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { BookingBar, BookingSummary } from '../../components/BookingSummary/BookingSummary.jsx';
import { BookingTicket } from '../../components/BookingTicket/BookingTicket.jsx';
import { DayStrip } from '../../components/DayStrip/DayStrip.jsx';
import { Navbar } from '../../components/Navbar/Navbar.jsx';
import { PeopleStepper } from '../../components/PeopleStepper/PeopleStepper.jsx';
import { ReviewDialog } from '../../components/ReviewDialog/ReviewDialog.jsx';
import { StepHeading } from '../../components/StepHeading/StepHeading.jsx';
import { TimeSlot } from '../../components/TimeSlot/TimeSlot.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useBookTable } from '../../hooks/useBookTable.js';
import { useLogout } from '../../hooks/useLogout.js';
import { formatTime, toDay } from '../../lib/bookingDates.js';
import styles from './BookTablePage.module.css';

// Sample data of the mockup, until the hut page story gives the real name and altitude.
const HUT_LABEL = 'Rifugio Alpe Lunga · 2.450 m';
const LINKS = [
  { to: '/', label: 'The hut' },
  { to: '/book', label: 'Book a table' },
];

const positiveInt = (value) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
};

export function BookTablePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { logout } = useLogout();
  const book = useBookTable({
    date: params.get('date') ?? undefined,
    partySize: positiveInt(params.get('people')),
    slotId: positiveInt(params.get('slot')),
  });
  const { date, slot, partySize, now } = book;

  const goToLogin = () => {
    const choices = new URLSearchParams({ people: String(partySize) });
    if (date) choices.set('date', date);
    if (slot) choices.set('slot', String(slot.slotId));
    navigate('/login', { state: { from: `/book?${choices}`, page: 'book a table' } });
  };

  const handleReview = () => {
    if (!isLoading && !isAuthenticated) goToLogin();
    else book.review();
  };

  const handleConfirm = async () => {
    if ((await book.confirm()) === 'login') goToLogin();
  };

  const navbar = <Navbar links={LINKS} user={user} onLogout={logout} />;

  if (book.booking) {
    return (
      <div className={styles.screen}>
        {navbar}
        <main className={styles.done}>
          <BookingTicket
            booking={book.booking}
            firstName={user?.firstName}
            onHome={() => navigate('/')}
            onBookAnother={book.startOver}
          />
        </main>
      </div>
    );
  }

  const today = toDay(now);

  return (
    <div className={styles.screen}>
      {navbar}
      <main className={styles.page}>
        <div className={styles.steps}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}>{HUT_LABEL}</p>
            <h1 className={styles.title}>Book a table</h1>
            <p className={styles.subtitle}>
              Choose the day, how many you are, and a time. You can book up to 2 hours before.
            </p>
          </header>

          {book.alert && <Alert>{book.alert}</Alert>}

          <section className={styles.step}>
            <StepHeading
              id="step-day"
              number={1}
              title="Day"
              done={Boolean(date)}
              aside={date === today && <span className={styles.clock}>Now {formatTime(now.toTimeString())}</span>}
            />
            <DayStrip
              days={book.days}
              selected={date}
              today={today}
              onSelect={book.chooseDate}
              labelledBy="step-day"
            />
          </section>

          <section className={styles.step}>
            <StepHeading id="step-people" number={2} title="How many people" done />
            <div className={styles.people}>
              <PeopleStepper
                value={partySize}
                max={book.maxPartySize}
                onChange={book.setPartySize}
                labelledBy="step-people"
              />
              <span className={styles.hint}>Including you.</span>
            </div>
          </section>

          <section className={styles.step}>
            <StepHeading id="step-time" number={3} title="Time" done={Boolean(slot)} />
            {book.slots.length > 0 ? (
              <div className={styles.slots} role="radiogroup" aria-labelledby="step-time">
                {book.slots.map((s) => (
                  <TimeSlot
                    key={s.slotId}
                    slot={s}
                    selected={slot?.slotId === s.slotId}
                    onSelect={() => book.chooseSlot(s.slotId)}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.hint}>{date ? 'No times on this day.' : 'Choose a day first.'}</p>
            )}
          </section>
        </div>

        <BookingSummary date={date} slot={slot} partySize={partySize} now={now} onReview={handleReview} />
      </main>

      <BookingBar date={date} slot={slot} partySize={partySize} onReview={handleReview} />

      <ReviewDialog
        open={book.isReviewing}
        date={date}
        slot={slot}
        partySize={partySize}
        isPending={book.isPending}
        onBack={book.back}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
