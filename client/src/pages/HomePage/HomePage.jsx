/**
 * PAGE: public availability search (MH-04), among staff-defined meal slots.
 * Keeps valid return-URL choices and navigates to the seating answer; no seats are reserved here.
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { Button } from '../../components/Button/Button.jsx';
import { TimeField } from '../../components/TimeField/TimeField.jsx';
import { useAvailabilityDays } from '../../hooks/useAvailabilityDays.js';
import { toDay } from '../../lib/bookingDates.js';
import { readBookingSearch } from '../../lib/availabilitySearch.js';
import styles from './HomePage.module.css';

export function HomePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initial = readBookingSearch(params);
  const { days, isLoading, error } = useAvailabilityDays();
  const today = toDay(new Date());
  const [date, setDay] = useState(initial.date >= today ? initial.date : today);
  const [people, setPeople] = useState(String(initial.partySize ?? 1));
  const [from, setFrom] = useState(initial.from ?? '');
  const [to, setTo] = useState(initial.to ?? '');
  const validDay = date >= today && days.includes(date);
  const validParty = Number.isSafeInteger(Number(people)) && Number(people) > 0;
  const invalidRange = Boolean(from && to && to <= from);
  const ready = validDay && validParty && from && to && !invalidRange && !isLoading && !error;
  const search = (event) => {
    event.preventDefault();
    if (!ready) return;
    const choices = new URLSearchParams({ date, people: String(Number(people)), from, to });
    navigate(`/book?${choices}`);
  };
  const changeFrom = (value) => {
    setFrom(value);
    if (to && to <= value) setTo('');
  };
  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="hut-title">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Rifugio Alpe Lunga · 2.450 m</p>
          <h1 id="hut-title">
            A table waits<br />at the top.
          </h1>
          <p className={styles.slogan}>Earn the climb. We keep your seat.</p>
        </div>
      </section>
      <div className={styles.content}>
        <form className={styles.search} onSubmit={search} aria-label="Check table availability">
          <label className={styles.field}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
            <span className={styles.fieldText}>
              <span>Day</span>
              <input
                aria-label="Day"
                type="date"
                min={today}
                required
                value={date}
                onChange={(event) => setDay(event.target.value)}
                aria-invalid={Boolean(date && !isLoading && !error && !validDay)}
              />
            </span>
          </label>
          <label className={styles.field}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" />
            </svg>
            <span className={styles.fieldText}>
              <span>People</span>
              <input
                aria-label="People"
                type="number"
                min="1"
                step="1"
                required
                value={people}
                onChange={(event) => setPeople(event.target.value)}
                aria-invalid={!validParty}
              />
            </span>
          </label>
          <TimeField label="From" value={from} onChange={changeFrom} />
          <TimeField label="To" value={to} after={from} onChange={setTo} />
          <Button type="submit" disabled={!ready}>Check availability</Button>
        </form>
        <div className={styles.messages}>
          {error && <Alert>{error}</Alert>}
          {!isLoading && !error && !days.length && <Alert>No meal slots are available yet.</Alert>}
          {!isLoading && !error && days.length > 0 && date >= today && !validDay && (
            <Alert>No meal slots are available on this day. Choose another day.</Alert>
          )}
          {date && date < today && <Alert>Choose today or a future day.</Alert>}
          {invalidRange && <Alert>Choose a To time later than From.</Alert>}
          {!validParty && <Alert>Enter a positive whole number of people.</Alert>}
        </div>
        <div className={styles.features}>
          <article>
            <h2>Free to check</h2>
            <p>See if there is room for your party, no login needed.</p>
          </article>
          <article>
            <h2>Your table is chosen for you</h2>
            <p>We keep your party together where we can.</p>
          </article>
          <article>
            <h2>Book until 2 hours before</h2>
            <p>Plans change on the mountain. So do meals.</p>
          </article>
        </div>
      </div>
      <footer className={styles.credit}>
        Photo: <a href="https://commons.wikimedia.org/wiki/File:Sangon_utia_da_mont_sun_Ciaulonch_cun_Odles_y_stevia.jpg">Wolfgang Moroder</a>
        {' · '}<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a> (resized and compressed).
      </footer>
    </main>
  );
}
