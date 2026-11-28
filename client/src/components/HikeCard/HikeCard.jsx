/**
 * One hike of "My hikes" (Figma "Hike card", mockup docs/mockups/register-a-hike, screens 1 and 8): the day of the
 * departure, the destination, the route, the departure and the return and, when there are any, the passage points in
 * order. A hike that does not start at the hut (`start` is not null) also says where it starts. A hike has no buttons: completing it (MH-22) and updating it (MH-27) are other stories.
 * `hike` is an item of GET /api/hikes.
 */
import passageIcon from '../../assets/hike/passage.svg';
import { dayParts } from '../../lib/bookingDates.js';
import { formatMoment } from '../../lib/changeBooking.js';
import styles from './HikeCard.module.css';

export function HikeCard({ hike }) {
  const { weekday, day, month } = dayParts(hike.departureAt.slice(0, 10));

  return (
    <li className={styles.card} aria-label={`Hike to ${hike.destination}`}>
      <div className={styles.day} aria-hidden="true">
        <span className={styles.weekday}>{weekday}</span>
        <span className={styles.number}>{day}</span>
        <span className={styles.month}>{month}</span>
      </div>

      <div className={styles.details}>
        <h3 className={styles.destination}>{hike.destination}</h3>
        {hike.start && <p className={styles.start}>From {hike.start}</p>}
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

        {hike.passagePoints.length > 0 && (
          <p className={styles.points}>
            <img src={passageIcon} width="16" height="16" alt="" />
            <span className={styles.hidden}>Passage points: </span>
            {hike.passagePoints.join(' → ')}
          </p>
        )}
      </div>
    </li>
  );
}
