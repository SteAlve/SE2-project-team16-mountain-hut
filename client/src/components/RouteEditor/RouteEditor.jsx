/**
 * "Your route" of the "Register a hike" dialog (Figma "Route point", MH-20, mockup docs/mockups/register-a-hike,
 * screens 3-6 and 9): the points of the hike one under the other, joined by a line, like a route.
 *   Start         the hut until the hiker changes it (a field), always first
 *   passage points  free text, in order; a handle moves a point (by dragging, or with the up and down keys) and a
 *                   button removes it. With many, the list keeps its height and scrolls inside; the start,
 *                   "Add a passage point" and the destination stay in view
 *   Destination   required, always last
 * It only draws its props: `start` and `destination` are the texts of the two fields; `points` is [{ id, text }], `route` is what hooks/useRouteDrag returns (the ref of the list,
 * the point being dragged and the props of each handle).
 */
import { useId } from 'react';
import addIcon from '../../assets/hike/add.svg';
import destinationIcon from '../../assets/hike/destination.svg';
import gripIcon from '../../assets/hike/grip.svg';
import passageIcon from '../../assets/hike/passage.svg';
import removeIcon from '../../assets/hike/remove.svg';
import startIcon from '../../assets/hike/start.svg';
import { DESTINATION_MAX, isNoMove, POINT_MAX, START_MAX } from '../../lib/hikes.js';
import styles from './RouteEditor.module.css';

export function RouteEditor({
  start,
  startError,
  points,
  destination,
  destinationError,
  canAdd,
  disabled = false,
  route,
  onStartChange,
  onDestinationChange,
  onPointChange,
  onRemove,
  onAdd,
}) {
  const id = useId();
  const { attachList, handleProps, drag } = route;
  // The line shows where the dragged point lands, unless that is where it already is.
  const dropAt = drag && !isNoMove(drag.from, drag.insertAt) ? drag.insertAt : null;

  return (
    <section className={styles.route} aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className={styles.title}>Your route</h3>
      <p className={styles.hint}>Drag a passage point to move it. The start and the destination keep their place.</p>

      <div className={`${styles.item} ${styles.start}`}>
        <img src={startIcon} width="28" height="28" alt="" className={styles.icon} />
        <label htmlFor={`${id}-start`} className={styles.label}>
          Start <span className={styles.required} aria-hidden="true">*</span>
        </label>
        <input
          id={`${id}-start`}
          className={`${styles.textInput} ${startError ? styles.invalid : ''}`}
          value={start}
          maxLength={START_MAX}
          placeholder="e.g. Rifugio Alpe Lunga"
          required
          disabled={disabled}
          aria-invalid={startError ? true : undefined}
          aria-describedby={startError ? `${id}-start-error` : undefined}
          onChange={(event) => onStartChange(event.target.value)}
        />
        {startError && <p id={`${id}-start-error`} className={styles.error}>{startError}</p>}
      </div>

      <ul ref={attachList} className={styles.list} aria-label="Passage points">
        {points.map((point, index) => {
          const name = point.text.trim() || `passage point ${index + 1}`;
          const drop = dropAt === index ? 'before' : dropAt === points.length && index === points.length - 1 ? 'after' : undefined;
          return (
            <li
              key={point.id}
              data-point=""
              data-drop={drop}
              className={`${styles.item} ${index === 0 ? styles.first : ''} ${drag?.from === index ? styles.dragging : ''}`}
            >
              <img src={passageIcon} width="28" height="28" alt="" className={styles.icon} />
              <div className={styles.point}>
                <button
                  type="button"
                  data-handle=""
                  className={styles.grip}
                  disabled={disabled}
                  aria-label={`Move ${name}`}
                  title="Drag to move, or use the up and down arrow keys"
                  {...handleProps(index)}
                >
                  <img src={gripIcon} width="20" height="20" alt="" draggable="false" />
                </button>
                <input
                  className={styles.pointInput}
                  value={point.text}
                  maxLength={POINT_MAX}
                  placeholder="Passage point"
                  aria-label={`Passage point ${index + 1}`}
                  disabled={disabled}
                  onChange={(event) => onPointChange(point.id, event.target.value)}
                />
                <button
                  type="button"
                  className={styles.remove}
                  disabled={disabled}
                  aria-label={`Remove ${name}`}
                  onClick={() => onRemove(point.id)}
                >
                  <img src={removeIcon} width="20" height="20" alt="" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={`${styles.item} ${styles.add}`}>
        {/* The + does the same as the text; it is left out of the tab order and of the screen readers, which have the text. */}
        <button
          type="button"
          className={`${styles.icon} ${styles.addIcon}`}
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled || !canAdd}
          onClick={onAdd}
        >
          <img src={addIcon} width="28" height="28" alt="" />
        </button>
        <button type="button" className={styles.addButton} disabled={disabled || !canAdd} onClick={onAdd}>
          Add a passage point
        </button>
      </div>

      <div className={`${styles.item} ${styles.destination}`}>
        <img src={destinationIcon} width="28" height="28" alt="" className={styles.icon} />
        <label htmlFor={`${id}-destination`} className={styles.label}>
          Destination <span className={styles.required} aria-hidden="true">*</span>
        </label>
        <input
          id={`${id}-destination`}
          className={`${styles.textInput} ${destinationError ? styles.invalid : ''}`}
          value={destination}
          maxLength={DESTINATION_MAX}
          placeholder="e.g. Lago Chiaretto"
          required
          disabled={disabled}
          aria-invalid={destinationError ? true : undefined}
          aria-describedby={destinationError ? `${id}-destination-error` : undefined}
          onChange={(event) => onDestinationChange(event.target.value)}
        />
        {destinationError && <p id={`${id}-destination-error`} className={styles.error}>{destinationError}</p>}
      </div>
    </section>
  );
}
