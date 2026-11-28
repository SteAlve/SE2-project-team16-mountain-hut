/**
 * "Register a hike" (story MH-20, mockup docs/mockups/register-a-hike, screens 3-9 and the phone sheet).
 * A dialog on desktop, a sheet from the bottom on a phone. Three steps (Start from a popular hike, When, Route
 * description) and "Your route" with the passage points and the destination. Nothing is saved until Register hike;
 * Close (or Esc) leaves everything as it is. While the hike is sent, every control is disabled.
 * `form` is what hooks/useRegisterHike returns.
 */
import { useEffect, useRef } from 'react';
import { NOT_SAVED, POPULAR_HIKES, ROUTE_MAX } from '../../lib/hikes.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { DateTimeField } from '../DateTimeField/DateTimeField.jsx';
import { HikeOption } from '../HikeOption/HikeOption.jsx';
import { Modal } from '../Modal/Modal.jsx';
import { RouteEditor } from '../RouteEditor/RouteEditor.jsx';
import { StepHeading } from '../StepHeading/StepHeading.jsx';
import { TextArea } from '../TextArea/TextArea.jsx';
import styles from './RegisterHikeDialog.module.css';

export function RegisterHikeDialog({ form, onClose, onSave }) {
  const { values, errors, isPending, stepsDone, refusals } = form;
  const body = useRef(null);

  // The dialog scrolls: after a refusal the first thing wrong is brought into view, the first field to fix with the
  // focus on it, or the red note of the server.
  useEffect(() => {
    if (refusals === 0) return;
    const field = body.current?.querySelector('[aria-invalid="true"]');
    if (field) field.focus();
    else body.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: 'nearest' });
  }, [refusals]);

  return (
    <Modal
      open
      medium
      titleId="register-hike-title"
      title="Register a hike"
      subtitle="Tell the hut where you are going and when you plan to be back. Nothing is saved until Register hike."
      isPending={isPending}
      onCancel={onClose}
      onSubmit={onSave}
      extra={<p className={styles.footer}>{form.refused ? NOT_SAVED : 'Nothing is saved yet.'}</p>}
      actions={
        <>
          <Button variant="outline" size="small" disabled={isPending} onClick={onClose}>
            Close
          </Button>
          <Button type="submit" size="small" disabled={isPending}>
            {isPending ? 'Registering…' : 'Register hike'}
          </Button>
        </>
      }
    >
      <div ref={body} className={styles.body}>
        <div className={styles.columns}>
          <fieldset className={styles.steps} disabled={isPending}>
            <section className={styles.step}>
              <StepHeading
                id="hike-step-popular"
                number={1}
                done={stepsDone.popular}
                title={
                  <>
                    Start from a popular hike <span className={styles.optional}>Optional</span>
                  </>
                }
              />
              <div className={styles.popular} role="radiogroup" aria-labelledby="hike-step-popular">
                {POPULAR_HIKES.map((hike) => (
                  <HikeOption key={hike.id} hike={hike} selected={form.popularId === hike.id} onSelect={() => form.choosePopular(hike)} />
                ))}
              </div>
            </section>

            <section className={styles.step}>
              <StepHeading id="hike-step-when" number={2} title="When" done={stepsDone.when} />
              <DateTimeField
                label="Departure"
                required
                day={values.departureDay}
                time={values.departureTime}
                onDayChange={(day) => form.set('departureDay', day)}
                onTimeChange={(time) => form.set('departureTime', time)}
                error={errors.departure}
              />
              <DateTimeField
                label="Expected return"
                required
                day={values.returnDay}
                time={values.returnTime}
                onDayChange={(day) => form.set('returnDay', day)}
                onTimeChange={(time) => form.set('returnTime', time)}
                error={errors.return}
              />
            </section>

            <section className={styles.step}>
              <StepHeading id="hike-step-route" number={3} title="Route description" done={stepsDone.route} />
              <TextArea
                label="Route"
                required
                placeholder="Describe the route, e.g. via the Chiaretto lake"
                maxLength={ROUTE_MAX}
                value={values.route}
                error={errors.route}
                onChange={(event) => form.set('route', event.target.value)}
              />
            </section>
          </fieldset>

          <div className={styles.side}>
            <RouteEditor
              start={values.start}
            startError={errors.start}
              points={form.points}
              destination={values.destination}
              destinationError={errors.destination}
              canAdd={form.canAddPoint}
              disabled={isPending}
              route={form.route}
              onStartChange={(text) => form.set('start', text)}
            onDestinationChange={(text) => form.set('destination', text)}
              onPointChange={form.changePoint}
              onRemove={form.removePoint}
              onAdd={form.addPoint}
            />
          </div>
        </div>

        {form.alert && <Alert>{form.alert}</Alert>}
      </div>
    </Modal>
  );
}
