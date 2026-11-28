/**
 * One hike of "My hikes" (Figma "Hike card", mockup docs/mockups/register-a-hike, screens 1 and 8): the day of the
 * departure, the destination, the route, the departure and the return, and the planned route: the start (the hut, or
 * the `start` of the hike), the destination and, between them, the line "Show N passage points" that opens the list of
 * the passage points in order ("Hide N passage points" closes it). A hike without passage points has no such line.
 * `open` opens the list at first: the hike just registered is shown with its points open (screen 8).
 * A hike has no buttons: completing it (MH-22) and updating it (MH-27) are other stories.
 * `hike` is an item of GET /api/hikes.
 */
import { useId, useState } from 'react';
import chevronIcon from '../../assets/booking/chevron.svg';
import destinationIcon from '../../assets/hike/destination.svg';
import passageIcon from '../../assets/hike/passage.svg';
import startIcon from '../../assets/hike/start.svg';
import { dayParts } from '../../lib/bookingDates.js';
import { formatMoment } from '../../lib/changeBooking.js';
import { passagePointsToggle, startOf } from '../../lib/hikes.js';
import styles from './HikeCard.module.css';

export function HikeCard({ hike, open = false }) {
  const id = useId();
  const [showPoints, setShowPoints] = useState(open);
  const { weekday, day, month } = dayParts(hike.departureAt.slice(0, 10));
  const count = hike.passagePoints.length;

  return (
    <li className={styles.card} aria-label={`Hike to ${hike.destination}`}>
      <div className={styles.day} aria-hidden="true">
        <span className={styles.weekday}>{weekday}</span>
        <span className={styles.number}>{day}</span>
        <span className={styles.month}>{month}</span>
      </div>

      <div className={styles.details}>
        <h3 className={styles.destination}>{hike.destination}</h3>
        <p className={styles.route}>{hike.route}</p>

        <dl className={styles.times}>
          <div className={styles.time}>
            <dt>Departure</dt>
            <dd>{formatMoment(hike.departureAt)}</dd>
          </div>
          <div className={styles.time}>
            <dt>Return</dt>
            <dd>{formatMoment(hike.returnAt)}</dd>
          </div>
        </dl>

        <div className={styles.planned}>
          <h4 id={`${id}-planned`} className={styles.plannedTitle}>Planned route</h4>
          <ol className={styles.points} aria-labelledby={`${id}-planned`}>
            <li className={styles.point}>
              <img src={startIcon} width="16" height="16" alt="" className={styles.icon} />
              <span className={styles.name}>{startOf(hike)}</span>
              <span className={styles.role}>Starting point</span>
            </li>
            {count > 0 && (
              <li className={styles.toggleRow}>
                <button
                  type="button"
                  className={styles.toggle}
                  aria-expanded={showPoints}
                  aria-controls={`${id}-points`}
                  onClick={() => setShowPoints((shown) => !shown)}
                >
                  <img
                    src={chevronIcon}
                    width="14"
                    height="14"
                    alt=""
                    className={`${styles.chevron} ${showPoints ? styles.up : ''}`}
                  />
                  {passagePointsToggle(count, showPoints)}
                </button>
                <ol id={`${id}-points`} className={styles.passages} hidden={!showPoints} aria-label="Passage points">
                  {hike.passagePoints.map((point, index) => (
                    // The same text can be there twice: the place in the route tells them apart.
                    <li key={index} className={styles.point}>
                      <img src={passageIcon} width="16" height="16" alt="" className={styles.icon} />
                      <span className={styles.name}>{point}</span>
                    </li>
                  ))}
                </ol>
              </li>
            )}
            <li className={styles.point}>
              <img src={destinationIcon} width="16" height="16" alt="" className={styles.icon} />
              <span className={styles.name}>{hike.destination}</span>
              <span className={styles.role}>Destination</span>
            </li>
          </ol>
        </div>
      </div>
    </li>
  );
}
