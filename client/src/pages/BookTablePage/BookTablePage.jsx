/**
 * BOOK A TABLE (story MH-01, mockup docs/mockups/booking): the hiker chooses the day, how many
 * they are and a time, checks the booking and confirms it. In the check the hiker can also give
 * the dietary needs and allergies of the party (MH-05, mockup docs/mockups/dietary).
 * The availability is public; booking needs a logged-in hiker. A visitor who is not logged in
 * chooses first and is sent to the login at Review booking, with `state: { from, page }`; the
 * choices travel in the URL of `from` (?date=&people=&slot=), so they are still there after the login.
 * An employee or the warden is told on arrival that only hikers can book, and Review booking is off.
 * The navbar and Log out come from AppLayout.
 */
import { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { BookingBar, BookingSummary } from '../../components/BookingSummary/BookingSummary.jsx';
import { BookingTicket } from '../../components/BookingTicket/BookingTicket.jsx';
import { DayStrip } from '../../components/DayStrip/DayStrip.jsx';
import { PeopleStepper } from '../../components/PeopleStepper/PeopleStepper.jsx';
import { ReviewDialog } from '../../components/ReviewDialog/ReviewDialog.jsx';
import { StepHeading } from '../../components/StepHeading/StepHeading.jsx';
import { TimeSlot } from '../../components/TimeSlot/TimeSlot.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useBookTable } from '../../hooks/useBookTable.js';
import { useDietaryNeeds } from '../../hooks/useDietaryNeeds.js';
import { usePublicAvailability } from '../../hooks/usePublicAvailability.js';
import { formatTime, toDay } from '../../lib/bookingDates.js';
import { readBookingSearch, withoutReviewFlag } from '../../lib/availabilitySearch.js';
import { ROLE_LABEL, STAFF_ROLES } from '../../lib/roles.js';
import styles from './BookTablePage.module.css';

// Sample data of the mockup, until the hut page story gives the real name and altitude.
const HUT_LABEL = 'Rifugio Alpe Lunga · 2.450 m';

export function BookTablePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user, isLoading, isAuthenticated } = useAuth();
  const initial = readBookingSearch(params);
  const { from, to, isSearch } = initial;
  const book = useBookTable(initial);
  const { date, slot, partySize, now } = book;
  // Kept outside the dialog: Back and a failed booking keep the lines.
  const needs = useDietaryNeeds(partySize);
  // The server refuses a booking by the staff (403): say it now, not at Confirm.
  const isStaff = STAFF_ROLES.includes(user?.role);
  const seatingAnswer = usePublicAvailability(slot, partySize, book.updateSlots);
  const searchMessage = !book.isLoading && !book.loadError && isSearch && !slot
    ? book.matchingCount === 0
      ? book.overlappingCount === 0
        ? { status: 'unavailable', message: `No meal slots overlap your selected time range (${from}–${to}) on this day.` }
        : { status: 'choice', message: `None of the ${book.overlappingCount} overlapping slots is currently bookable for ${partySize} people. Choose a time to check its availability.` }
      : { status: 'choice', message: `${book.matchingCount} overlapping ${book.matchingCount === 1 ? 'slot is' : 'slots are'} currently bookable for ${partySize} people. Choose one to check availability.` }
    : null;
  const availability = seatingAnswer ?? searchMessage;
  const canReview = !isLoading && !isStaff && availability?.status === 'available' && !availability.isRefreshing;
  const resume = useRef(false);
  useEffect(() => {
    if (params.get('review') !== '1' || resume.current || !isAuthenticated || !canReview) return;
    resume.current = true;
    setParams(withoutReviewFlag(params), { replace: true });
    book.review();
  }, [params, setParams, isAuthenticated, canReview, book]);

  const goToLogin = () => {
    const choices = new URLSearchParams({ people: String(partySize) });
    if (date) choices.set('date', date);
    if (slot) choices.set('slot', String(slot.slotId));
    if (isSearch) { choices.set('from', from); choices.set('to', to); }
    choices.set('review', '1');
    navigate('/login', { state: { from: `/book?${choices}`, page: 'book a table' } });
  };

  const handleReview = () => {
    if (!canReview) return;
    if (!isLoading && !isAuthenticated) goToLogin();
    else book.review();
  };

  const handleConfirm = async () => {
    // A line that cannot be sent stays open in the dialog, with the problem marked.
    if (!needs.check()) return;
    if ((await book.confirm(needs.requirements)) === 'login') goToLogin();
  };

  // Back keeps the lines, folded: the next check shows them as rows.
  const backFromReview = () => {
    needs.open(null);
    book.back();
  };

  const bookAnother = () => {
    needs.reset();
    book.startOver();
  };

  if (book.booking) {
    return (
      <div className={styles.screen}>
        <main className={styles.done}>
          <BookingTicket
            booking={book.booking}
            firstName={user?.firstName}
            onHome={() => navigate('/')}
            onBookAnother={bookAnother}
          />
        </main>
      </div>
    );
  }

  const today = toDay(now);

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <div className={styles.steps}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}>{HUT_LABEL}</p>
            <div className={styles.headingRow}>
              <h1 className={styles.title}>Book a table</h1>
              {isSearch && <Link to={`/?${new URLSearchParams({ date: date ?? '', people: String(partySize), from, to })}`}>Change search</Link>}
            </div>
            <p className={styles.subtitle}>
              Choose the day, how many you are, and a time. You can book up to 2 hours before.
            </p>
          </header>

          {isStaff && (
            <Alert variant="info">
              Only hikers can book a table. You are logged in as a {ROLE_LABEL[user.role].toLowerCase()}.
            </Alert>
          )}
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
              onReachEnd={book.showMoreDays}
              onReachStart={book.canShowEarlierDays ? book.showEarlierDays : undefined}
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
                    allowUnavailable={isSearch}
                    onSelect={() => book.chooseSlot(s.slotId)}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.hint}>{book.loadError ? 'Meal times could not be loaded.' : date ? 'No times on this day.' : 'Choose a day first.'}</p>
            )}
          </section>
        </div>

        <BookingSummary
          date={date}
          slot={slot}
          partySize={partySize}
          now={now}
          isPending={book.isPending}
          canBook={!isStaff}
          availability={availability}
          searchRange={isSearch ? `${from} to ${to}` : null}
          isAvailable={Boolean(canReview)}
          onReview={handleReview}
        />
      </main>

      <BookingBar
        date={date}
        slot={slot}
        partySize={partySize}
        now={now}
        isPending={book.isPending}
        canBook={!isStaff}
        availability={availability}
        searchRange={isSearch ? `${from} to ${to}` : null}
        isAvailable={Boolean(canReview)}
        onReview={handleReview}
      />

      <ReviewDialog
        open={book.isReviewing}
        date={date}
        slot={slot}
        partySize={partySize}
        tables={book.tables}
        needs={needs}
        partyHeading={isSearch && book.tables ? `${book.tables.map(({ seats }) => seats).join(' + ')} seats` : undefined}
        notice={book.reviewNotice}
        isPending={book.isPending}
        onBack={backFromReview}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
