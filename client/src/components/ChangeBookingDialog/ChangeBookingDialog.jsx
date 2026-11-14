/**
 * "Change your booking" (story MH-06, mockup docs/mockups/hiker-booking-page, screens 3-9 and the phone sheet).
 * A dialog on desktop, a sheet from the bottom on a phone. The booking is filled in with the same three steps
 * as Book a table (Day, How many people, Time), "After the change" says what would be saved, and the dietary
 * needs are edited as in MH-05. Nothing is saved until Save changes; Close (or Esc) leaves the booking as it is.
 * While a guest's needs are being edited (screen 8) the steps and "After the change" give way to "Your booking",
 * a summary of the booking, so the editor has the room it needs; the choices already made are kept.
 * `booking` is the saved booking; `change` is what hooks/useChangeBooking returns.
 */
import { formatDay, formatTimeRange } from '../../lib/bookingDates.js';
import { bookingNow, bookingReference } from '../../lib/changeBooking.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { DayStrip } from '../DayStrip/DayStrip.jsx';
import { DietaryNeeds } from '../DietaryNeeds/DietaryNeeds.jsx';
import { Modal } from '../Modal/Modal.jsx';
import { PeopleStepper } from '../PeopleStepper/PeopleStepper.jsx';
import { StepHeading } from '../StepHeading/StepHeading.jsx';
import { TimeSlot } from '../TimeSlot/TimeSlot.jsx';
import styles from './ChangeBookingDialog.module.css';

function footerText({ alert, needsOnly, editingNeeds, seatsChange }) {
  if (alert) return 'Your booking has not changed.';
  if (editingNeeds && !seatsChange) return 'Dietary changes need no availability check.';
  return needsOnly ? 'Day, time and tables unchanged.' : 'Nothing is saved yet.';
}

export function ChangeBookingDialog({ booking, change, today, onClose, onSave }) {
  const { date, slot, partySize, needs, needsOnly, isPending, alert } = change;
  const seatsChange = 'slotId' in change.changes || 'partySize' in change.changes;
  const editingNeeds = needs.openKey !== null;

  return (
    <Modal
      open
      wider
      titleId="change-title"
      title={
        <>
          Change your booking <span className={styles.reference}>{bookingReference(booking.id)}</span>
        </>
      }
      subtitle={`Now: ${bookingNow(booking)}. Nothing changes until you save.`}
      isPending={isPending}
      onCancel={onClose}
      onSubmit={onSave}
      extra={<p className={styles.footer}>{footerText({ alert, needsOnly, editingNeeds, seatsChange })}</p>}
      actions={
        <>
          <Button variant="outline" size="small" disabled={isPending} onClick={onClose}>
            Close
          </Button>
          <Button type="submit" size="small" disabled={!change.canSave}>
            {isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className={`${styles.columns} ${editingNeeds ? styles.needsMode : ''}`}>
        <div className={styles.steps}>
          {editingNeeds ? (
            <section className={styles.after} aria-labelledby="change-now-title">
              <h3 id="change-now-title" className={styles.afterTitle}>Your booking</h3>
              <dl className={styles.rows}>
                <div className={styles.row}>
                  <dt>Day</dt>
                  <dd>{formatDay(date)}</dd>
                </div>
                <div className={styles.row}>
                  <dt>Time</dt>
                  <dd className={styles.mono}>
                    {slot ? formatTimeRange(slot.startsAt, slot.endsAt) : formatTimeRange(booking.startsAt, booking.endsAt)}
                  </dd>
                </div>
                <div className={styles.row}>
                  <dt>People</dt>
                  <dd>{partySize}</dd>
                </div>
              </dl>
            </section>
          ) : (
            <>
          <section className={styles.step}>
            <StepHeading id="change-step-day" number={1} title="Day" done />
            <DayStrip
              days={change.days}
              selected={date}
              today={today}
              onSelect={change.chooseDate}
              onReachEnd={change.showMoreDays}
              labelledBy="change-step-day"
            />
          </section>

          <section className={styles.step}>
            <StepHeading id="change-step-people" number={2} title="How many people" done />
            <div className={styles.people}>
              <PeopleStepper
                value={partySize}
                max={Number.MAX_SAFE_INTEGER}
                onChange={change.setPartySize}
                labelledBy="change-step-people"
              />
              <span className={styles.hint}>Including you.</span>
            </div>
          </section>

          <section className={styles.step}>
            <StepHeading id="change-step-time" number={3} title="Time" done={Boolean(slot)} />
            {change.slots.length > 0 ? (
              <div className={styles.slots} role="radiogroup" aria-labelledby="change-step-time">
                {change.slots.map((s) => (
                  <TimeSlot key={s.slotId} slot={s} selected={slot?.slotId === s.slotId} onSelect={() => change.chooseSlot(s.slotId)} />
                ))}
              </div>
            ) : (
              <p className={styles.hint}>{change.isLoading ? 'Loading the times…' : 'No times on this day.'}</p>
            )}
          </section>
            </>
          )}
        </div>

        <div className={styles.side}>
          {editingNeeds ? null : needsOnly ? (
            <Alert variant="info">
              Only the dietary needs changed. No availability check is needed and your tables stay the same.
            </Alert>
          ) : (
            <section className={styles.after} aria-labelledby="change-after-title">
              <h3 id="change-after-title" className={styles.afterTitle}>After the change</h3>
              <dl className={styles.rows}>
                <div className={styles.row}>
                  <dt>Day</dt>
                  <dd>{formatDay(date)}</dd>
                </div>
                <div className={styles.row}>
                  <dt>Time</dt>
                  <dd className={styles.mono}>{slot ? formatTimeRange(slot.startsAt, slot.endsAt) : 'Choose a time'}</dd>
                </div>
                <div className={styles.row}>
                  <dt>People</dt>
                  <dd>{partySize === booking.partySize ? partySize : `${booking.partySize} → ${partySize}`}</dd>
                </div>
                <div className={styles.row}>
                  <dt>Tables</dt>
                  <dd className={styles.muted}>{seatsChange ? 'Chosen when you save' : 'Unchanged'}</dd>
                </div>
              </dl>
            </section>
          )}

          {alert && <Alert>{alert}</Alert>}

          <DietaryNeeds needs={needs} partySize={partySize} disabled={isPending} />
        </div>
      </div>
    </Modal>
  );
}
