/**
 * The open editor of one line of dietary needs (Figma "Guest needs editor", MH-05 screens 2-3):
 * how many guests, the Diet cards, the Allergies cards, the Other fields and Other requests.
 * `line` is a line of lib/dietaryNeeds.js; `maxGuests` is the top of the Guests stepper.
 * `errors` is lineErrors(line) once Confirm checked it, otherwise {}.
 */
import { useEffect, useId, useRef } from 'react';
import eggs from '../../assets/dietary/eggs.svg';
import fish from '../../assets/dietary/fish.svg';
import gluten from '../../assets/dietary/gluten.svg';
import lactoseFree from '../../assets/dietary/lactose-free.svg';
import milk from '../../assets/dietary/milk.svg';
import other from '../../assets/dietary/other.svg';
import peanuts from '../../assets/dietary/peanuts.svg';
import pescatarian from '../../assets/dietary/pescatarian.svg';
import removeIcon from '../../assets/dietary/remove.svg';
import shellfish from '../../assets/dietary/shellfish.svg';
import treeNuts from '../../assets/dietary/tree-nuts.svg';
import vegan from '../../assets/dietary/vegan.svg';
import vegetarian from '../../assets/dietary/vegetarian.svg';
import { ALLERGIES, DIETS, guests, OTHER } from '../../lib/dietaryNeeds.js';
import { NeedCard } from '../NeedCard/NeedCard.jsx';
import { PeopleStepper } from '../PeopleStepper/PeopleStepper.jsx';
import { TextField } from '../TextField/TextField.jsx';
import styles from './GuestNeedsEditor.module.css';

const DIET_ICONS = { VEGETARIAN: vegetarian, VEGAN: vegan, PESCATARIAN: pescatarian, LACTOSE_FREE: lactoseFree, [OTHER]: other };
const ALLERGY_ICONS = {
  GLUTEN: gluten,
  MILK: milk,
  EGGS: eggs,
  PEANUTS: peanuts,
  TREE_NUTS: treeNuts,
  FISH: fish,
  SHELLFISH: shellfish,
  [OTHER]: other,
};

export function GuestNeedsEditor({
  line,
  maxGuests,
  errors,
  disabled,
  onGuests,
  onToggleDiet,
  onToggleAllergy,
  onText,
  onRemove,
}) {
  const id = useId();
  const ref = useRef(null);
  const text = (field) => (event) => onText(field, event.target.value);

  // Confirm opens the first line with a problem: bring it into view, the dialog may be scrolled away.
  const hasErrors = Object.keys(errors).length > 0;
  useEffect(() => {
    if (hasErrors) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [hasErrors]);

  return (
    <div
      ref={ref}
      className={`${styles.editor} ${errors.line ? styles.invalid : ''}`}
      role="group"
      aria-labelledby={`${id}-title`}
    >
      <div className={styles.head}>
        <p id={`${id}-title`} className={styles.title}>{guests(line.guests)}</p>
        <button type="button" className={styles.remove} aria-label="Remove these needs" disabled={disabled} onClick={onRemove}>
          <img src={removeIcon} width="20" height="20" alt="" />
        </button>
      </div>
      {errors.line && <p className={styles.error}>{errors.line}</p>}

      <div className={styles.count}>
        <p className={styles.label}>
          <span id={`${id}-guests`} className={styles.group}>Guests</span>
          <span className={styles.hint}>
            <span className={styles.wide}>how many guests have exactly these needs</span>
            <span className={styles.narrow}>how many have these needs</span>
          </span>
        </p>
        <PeopleStepper value={line.guests} max={maxGuests} onChange={onGuests} labelledBy={`${id}-guests`} />
      </div>

      <p className={styles.label}>
        <span id={`${id}-diet`} className={styles.group}>Diet</span>
        <span className={styles.hint}>choose all that apply · at most one of Vegetarian, Vegan, Pescatarian</span>
      </p>
      <div className={styles.cards} role="group" aria-labelledby={`${id}-diet`}>
        {DIETS.map(({ code, name }) => (
          <NeedCard
            key={code}
            kind="diet"
            name={name}
            icon={DIET_ICONS[code]}
            selected={line.diets.includes(code)}
            disabled={disabled}
            onToggle={() => onToggleDiet(code)}
          />
        ))}
      </div>
      {line.diets.includes(OTHER) && (
        <TextField
          label="Which diet?"
          required
          placeholder="e.g. halal, kosher"
          helper="Up to 100 characters."
          error={errors.otherDiet}
          value={line.otherDiet}
          disabled={disabled}
          onChange={text('otherDiet')}
        />
      )}

      <p className={styles.label}>
        <span id={`${id}-allergies`} className={styles.group}>Allergies</span>
        <span className={styles.hint}>choose all that apply</span>
      </p>
      <div className={styles.cards} role="group" aria-labelledby={`${id}-allergies`}>
        {ALLERGIES.map(({ code, name }) => (
          <NeedCard
            key={code}
            kind="allergy"
            name={name}
            icon={ALLERGY_ICONS[code]}
            selected={line.allergies.includes(code)}
            disabled={disabled}
            onToggle={() => onToggleAllergy(code)}
          />
        ))}
      </div>
      {line.allergies.includes(OTHER) && (
        <TextField
          label="Which allergy?"
          required
          placeholder="e.g. sesame, celery, mustard"
          helper="Up to 100 characters."
          error={errors.otherAllergy}
          value={line.otherAllergy}
          disabled={disabled}
          onChange={text('otherAllergy')}
        />
      )}

      <p className={styles.label}>
        <span className={styles.group}>Other requests</span>
        <span className={styles.hint}>optional · not a diet or an allergy</span>
      </p>
      <TextField
        label="Anything else the kitchen should know?"
        placeholder="e.g. no spicy food, a small portion"
        helper="Up to 300 characters."
        error={errors.otherRequests}
        value={line.otherRequests}
        disabled={disabled}
        onChange={text('otherRequests')}
      />
    </div>
  );
}
