/**
 * A preset diet or allergy, chosen by tapping it (Figma "Need card"): icon in the middle, name
 * centred below. Selected, a diet is green and an allergy red, with a check mark.
 * `kind` is 'diet' or 'allergy'; `icon` is the URL of the 24 px icon.
 */
import checkAllergy from '../../assets/dietary/selected-allergy.svg';
import checkDiet from '../../assets/dietary/selected-diet.svg';
import styles from './NeedCard.module.css';

export function NeedCard({ kind, name, icon, selected, disabled, onToggle }) {
  return (
    <button
      type="button"
      className={`${styles.card} ${selected ? styles[kind] : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
    >
      <img src={icon} width="24" height="24" alt="" />
      <span className={styles.name}>{name}</span>
      {selected && (
        <img
          className={styles.check}
          src={kind === 'allergy' ? checkAllergy : checkDiet}
          width="18"
          height="18"
          alt=""
        />
      )}
    </button>
  );
}
