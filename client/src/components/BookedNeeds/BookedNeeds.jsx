/**
 * The dietary needs in "Table booked" (story MH-05, mockup screens 5-7 and P2), as the server saved
 * them. Guests with exactly the same needs share one card with ×N; the cards of a row have the
 * same height and start from the top. `requirements` are the ones of the saved booking.
 */
import peopleIcon from '../../assets/dietary/people.svg';
import { groupRequirements, guests } from '../../lib/dietaryNeeds.js';
import { NeedChip } from '../NeedChip/NeedChip.jsx';
import styles from './BookedNeeds.module.css';

export function BookedNeeds({ requirements, partySize }) {
  const groups = groupRequirements(requirements);
  return (
    <section className={styles.needs} aria-labelledby="booked-needs-title">
      <h2 id="booked-needs-title" className={styles.label}>
        Dietary needs · {requirements.length} of {guests(partySize)}
      </h2>
      <ul className={`${styles.grid} ${groups.length === 1 ? styles.single : ''}`}>
        {groups.map((group, i) => (
          <li key={i} className={styles.group}>
            <p className={styles.count}>
              <img src={peopleIcon} width="18" height="18" alt="" />
              <span aria-hidden="true">×{group.count}</span>
              <span className={styles.hidden}>{guests(group.count)}:</span>
            </p>
            <div className={styles.what}>
              <div className={styles.chips}>
                {group.chips.map((chip, j) => <NeedChip key={j} kind={chip.kind} name={chip.name} />)}
              </div>
              {group.request && <p className={styles.request}>“{group.request}”</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
