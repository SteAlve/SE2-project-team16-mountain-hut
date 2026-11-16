/**
 * NEW RESERVATION (story MH-07, mockup docs/mockups/reservation-for-a-hiker): an employee or the
 * warden enters a reservation for a hiker who is at the hut, phones or writes.
 *   1. Hiker: found by name, phone or email (hooks/useHikerSearch.js), or added with "New hiker"
 *      (a temporary hiker, or a hiker account whose password the server emails to the hiker).
 *   2-4. Day, how many people and time, locked until the hiker is chosen. A time can be entered
 *      until it starts.
 * Save reservation books the tables the server proposes (hooks/useStaffReservation.js), then
 * "Reservation saved" shows them. Done and "+ New reservation" both close it and start again from
 * zero on this page; Done can lead to the list of the reservations once it exists (MH-08).
 * The navbar and Log out come from AppLayout; RequireRole keeps hikers and visitors out, and a 401
 * of the server sends to the login, and back here after it.
 */
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Button } from '../../components/Button/Button.jsx';
import { DayStrip } from '../../components/DayStrip/DayStrip.jsx';
import { HikerOption } from '../../components/HikerOption/HikerOption.jsx';
import { NewHikerDialog } from '../../components/NewHikerDialog/NewHikerDialog.jsx';
import { PeopleStepper } from '../../components/PeopleStepper/PeopleStepper.jsx';
import { ReservationBar, ReservationSummary } from '../../components/ReservationSummary/ReservationSummary.jsx';
import { ReservationSavedDialog } from '../../components/ReservationSavedDialog/ReservationSavedDialog.jsx';
import { StepHeading } from '../../components/StepHeading/StepHeading.jsx';
import { TextField } from '../../components/TextField/TextField.jsx';
import { TimeSlot } from '../../components/TimeSlot/TimeSlot.jsx';
import { useHikerSearch } from '../../hooks/useHikerSearch.js';
import { useStaffReservation } from '../../hooks/useStaffReservation.js';
import { toDay } from '../../lib/bookingDates.js';
import { searchSummary } from '../../lib/hikers.js';
import { PAGES } from '../../lib/roles.js';
import styles from './NewReservationPage.module.css';

// Sample data of the mockup, until the hut page story gives the real name and altitude.
const HUT_LABEL = 'Rifugio Alpe Lunga · 2.450 m';
// "Log in to enter a reservation."
const LOGIN_PAGE = 'enter a reservation';

export function NewReservationPage() {
  // "+ New reservation" mounts a new form, so every choice starts from zero.
  const [round, setRound] = useState(0);
  return <ReservationForm key={round} onNew={() => setRound((n) => n + 1)} />;
}

function ReservationForm({ onNew }) {
  const page = useStaffReservation();
  const [query, setQuery] = useState('');
  const search = useHikerSearch(query);
  // The key of the New hiker dialog while it is open: a new one at every opening, so it starts empty.
  const [newHiker, setNewHiker] = useState(null);
  const [opened, setOpened] = useState(0);

  if (page.needsLogin || search.failure === 'login') {
    return <Navigate to="/login" replace state={{ from: PAGES.reservations.path, page: LOGIN_PAGE }} />;
  }

  const { hiker, date, slot, partySize, now } = page;
  const locked = !hiker;
  const searchError = search.failure ?? undefined;

  const openNewHiker = () => {
    setOpened((n) => n + 1);
    setNewHiker(opened);
  };

  const saveHiker = async (form) => {
    const result = await page.addHiker(form);
    if (result.ok) setNewHiker(null);
    return result;
  };

  const chooseOwner = (owner) => {
    page.chooseHiker(owner);
    setNewHiker(null);
  };

  const summary = {
    hiker,
    date,
    slot,
    partySize,
    now,
    alert: page.alert,
    isPending: page.isPending,
    onSave: page.save,
  };

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <div className={styles.steps}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}>{HUT_LABEL}</p>
            <h1 className={styles.title}>New reservation</h1>
            <p className={styles.subtitle}>
              For a hiker at the hut, on the phone or by message. You can enter it until the time starts.
            </p>
          </header>

          <section className={styles.step}>
            <StepHeading id="step-hiker" number={1} title="Hiker" done />
            {hiker ? (
              <div className={styles.chosen}>
                <HikerOption hiker={hiker} />
                <Button variant="outline" size="small" disabled={page.isPending} onClick={page.changeHiker}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <TextField
                  label="Find the hiker"
                  search
                  type="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  placeholder="Name, phone or email"
                  value={query}
                  helper={search.isActive ? searchSummary(search.hikers) : undefined}
                  error={searchError}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {search.isActive && !searchError && search.hikers?.length > 0 && (
                  <div className={styles.hikers} role="radiogroup" aria-label="Hikers found">
                    {search.hikers.map((found) => (
                      <HikerOption key={found.id} hiker={found} onSelect={() => page.chooseHiker(found)} />
                    ))}
                  </div>
                )}
                <div className={styles.newHiker}>
                  <span>{search.isActive ? 'Not in the list?' : 'New to the hut?'}</span>
                  <Button variant="outline" size="small" onClick={openNewHiker}>
                    + New hiker
                  </Button>
                </div>
              </>
            )}
          </section>

          <section className={styles.step}>
            <StepHeading id="step-day" number={2} title="Day" done={!locked} />
            {locked ? (
              <p className={styles.hint}>Choose the hiker first.</p>
            ) : (
              <DayStrip
                days={page.days}
                selected={date}
                today={toDay(now)}
                onSelect={page.chooseDate}
                onReachEnd={page.showMoreDays}
                labelledBy="step-day"
              />
            )}
          </section>

          <section className={styles.step}>
            <StepHeading id="step-people" number={3} title="How many people" done={!locked} />
            {!locked && (
              <div className={styles.people}>
                <PeopleStepper
                  value={partySize}
                  max={page.maxPartySize}
                  onChange={page.setPartySize}
                  labelledBy="step-people"
                />
                <span className={styles.hint}>Including the hiker.</span>
              </div>
            )}
          </section>

          <section className={styles.step}>
            <StepHeading id="step-time" number={4} title="Time" done={Boolean(slot)} />
            {!locked && (page.slots.length > 0 ? (
              <div className={styles.slots} role="radiogroup" aria-labelledby="step-time">
                {page.slots.map((s) => (
                  <TimeSlot
                    key={s.slotId}
                    slot={s}
                    selected={slot?.slotId === s.slotId}
                    onSelect={() => page.chooseSlot(s.slotId)}
                  />
                ))}
              </div>
            ) : (
              <p className={styles.hint}>
                {page.isLoadingSlots ? 'Loading…' : page.loadError ? 'Meal times could not be loaded.' : 'No times on this day.'}
              </p>
            ))}
          </section>
        </div>

        <ReservationSummary {...summary} />
      </main>

      <ReservationBar {...summary} />

      {newHiker !== null && (
        <NewHikerDialog
          key={newHiker}
          open
          isPending={page.isPending}
          onSave={saveHiker}
          onChoose={chooseOwner}
          onCancel={() => setNewHiker(null)}
        />
      )}

      {page.saved && (
        <ReservationSavedDialog
          saved={page.saved}
          now={now}
          onNew={onNew}
          onDone={onNew}
        />
      )}
    </div>
  );
}
