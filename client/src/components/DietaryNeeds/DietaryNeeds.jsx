/**
 * "Dietary needs and allergies" in Check your booking (story MH-05, mockup screens 1-4 and P1):
 * the folded lines, the line being edited and "+ Add a guest's needs" with the guests counted.
 * `needs` is what hooks/useDietaryNeeds returns; `disabled` while the booking is being sent.
 */
import removeIcon from '../../assets/dietary/remove.svg';
import { guests, lineChips } from '../../lib/dietaryNeeds.js';
import { Button } from '../Button/Button.jsx';
import { GuestNeedsEditor } from '../GuestNeedsEditor/GuestNeedsEditor.jsx';
import { NeedChip } from '../NeedChip/NeedChip.jsx';
import styles from './DietaryNeeds.module.css';

const NO_ERRORS = {};

function Counter({ counted, partySize, tooMany }) {
  let status = null;
  if (tooMany) status = ' · more than your party: remove a line or lower its guests';
  else if (counted === partySize) status = ' · every guest is counted';
  return (
    <p className={`${styles.counter} ${tooMany ? styles.over : ''}`} aria-live="polite">
      {counted} of {partySize}
      <span className={styles.wide}> guests</span>
      {status}
    </p>
  );
}

function FoldedLine({ line, number, invalid, disabled, onOpen, onRemove }) {
  const chips = lineChips(line);
  return (
    <div className={`${styles.row} ${invalid ? styles.rowInvalid : ''}`}>
      <span className={styles.rowGuests}>{guests(line.guests)}</span>
      <span className={styles.chips}>
        {chips.length > 0
          ? chips.map((chip, i) => <NeedChip key={i} kind={chip.kind} name={chip.name} />)
          : <span className={styles.nothing}>Nothing chosen yet</span>}
      </span>
      <Button variant="ghost" size="small" disabled={disabled} aria-label={`Edit line ${number}`} onClick={onOpen}>
        Edit
      </Button>
      <button type="button" className={styles.remove} aria-label={`Remove line ${number}`} disabled={disabled} onClick={onRemove}>
        <img src={removeIcon} width="20" height="20" alt="" />
      </button>
    </div>
  );
}

export function DietaryNeeds({ needs, partySize, disabled }) {
  const { lines, openKey, counted, tooMany, errors } = needs;
  const free = Math.max(partySize - counted, 0);

  const add = (
    <div className={styles.add}>
      <Button variant="ghost" size="small" className={styles.addButton} disabled={disabled || free === 0} onClick={needs.add}>
        +&nbsp;&nbsp;Add a guest&apos;s needs
      </Button>
      <Counter counted={counted} partySize={partySize} tooMany={tooMany} />
    </div>
  );

  return (
    <section className={styles.needs} aria-labelledby="needs-title">
      <div className={styles.head}>
        <h3 id="needs-title" className={styles.title}>Dietary needs and allergies</h3>
        <span className={styles.optional}>Optional</span>
      </div>
      <p className={styles.help}>
        <span className={styles.wide}>
          Add the needs of the guests who have any. Guests with exactly the same needs share one line:
          set how many they are. Choosing an allergy tells the kitchen to take special care.
        </span>
        <span className={styles.narrow}>
          Guests with the same needs share one line. An allergy tells the kitchen to take special care.
        </span>
      </p>

      {lines.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No dietary needs or allergies for this booking.</p>
          {add}
        </div>
      ) : (
        <>
          <ul className={styles.lines}>
            {lines.map((line, i) => (
              <li key={line.key}>
                {line.key === openKey ? (
                  <GuestNeedsEditor
                    line={line}
                    maxGuests={line.guests + free}
                    errors={errors[line.key] ?? NO_ERRORS}
                    disabled={disabled}
                    onGuests={(n) => needs.setGuests(line.key, n)}
                    onToggleDiet={(code) => needs.toggleDiet(line.key, code)}
                    onToggleAllergy={(code) => needs.toggleAllergy(line.key, code)}
                    onText={(field, value) => needs.setText(line.key, field, value)}
                    onRemove={() => needs.remove(line.key)}
                  />
                ) : (
                  <FoldedLine
                    line={line}
                    number={i + 1}
                    invalid={Boolean(errors[line.key])}
                    disabled={disabled}
                    onOpen={() => needs.open(line.key)}
                    onRemove={() => needs.remove(line.key)}
                  />
                )}
              </li>
            ))}
          </ul>
          {add}
        </>
      )}
    </section>
  );
}
