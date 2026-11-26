/**
 * Copy the seven-day schedule beginning on the selected carousel day (MH-09).
 * The hook owns API calls; this component only renders the selection and confirmation steps.
 */
import { useState } from 'react';
import { formatDay } from '../../lib/bookingDates.js';
import { Alert } from '../Alert/Alert.jsx';
import { Button } from '../Button/Button.jsx';
import { Modal } from '../Modal/Modal.jsx';
import styles from './CopyWeekDialog.module.css';

const periodLabel = ({ from, to }) => `${formatDay(from)} – ${formatDay(to)}`;

export function CopyWeekDialog({
  open,
  periods,
  destinations,
  selected,
  selectedPeriods,
  replacedSlots,
  alert,
  isPending,
  onToggle,
  onShowMore,
  onCopy,
  onCancel,
  onCopied,
}) {
  const [step, setStep] = useState('choose');

  const source = periods?.[0];
  const submit = async () => {
    if (selectedPeriods.length === 0) return;
    if (step === 'choose' && replacedSlots > 0) {
      setStep('confirm');
      return;
    }
    const result = await onCopy();
    if (result.ok) onCopied({ source, selectedPeriods, result: result.result });
    else setStep('choose');
  };

  const sourceDays = source?.days ?? [];

  return (
    <Modal
      open={open}
      title={step === 'choose' ? 'Copy this week' : `Replace the slots of ${selectedPeriods.length} period${selectedPeriods.length === 1 ? '' : 's'}?`}
      titleId="copy-week-title"
      wide
      isPending={isPending}
      onCancel={onCancel}
      onSubmit={submit}
      actions={step === 'confirm' ? (
        <>
          <Button variant="outline" size="small" disabled={isPending} onClick={() => setStep('choose')}>
            Go back
          </Button>
          <Button type="submit" size="small" disabled={isPending}>
            {isPending ? 'Copying…' : 'Replace and copy'}
          </Button>
        </>
      ) : (
        <>
          <Button variant="outline" size="small" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="small" disabled={isPending || !source || source.slotCount === 0 || selectedPeriods.length === 0}>
            {isPending ? 'Copying…' : `Copy to ${selectedPeriods.length} period${selectedPeriods.length === 1 ? '' : 's'}`}
          </Button>
        </>
      )}
    >
      {alert && <Alert>{alert}</Alert>}

      {step === 'confirm' ? (
        <div className={styles.confirmation}>
          {selectedPeriods.filter((period) => period.slotCount > 0).map((period) => (
            <p key={period.from}>
              <strong>{periodLabel(period)}</strong> has {period.slotCount} slot{period.slotCount === 1 ? '' : 's'} and no bookings. They will be deleted and replaced.
            </p>
          ))}
          {selectedPeriods.some((period) => period.slotCount === 0) && (
            <p>{selectedPeriods.filter((period) => period.slotCount === 0).length} selected period{selectedPeriods.filter((period) => period.slotCount === 0).length === 1 ? ' is' : 's are'} empty, so nothing is replaced there.</p>
          )}
        </div>
      ) : periods === null ? (
        <p className={styles.loading}>Loading continuation periods…</p>
      ) : (
        <>
          <section className={styles.source} aria-label="Source period">
            <div className={styles.sectionTitle}>
              <strong>Period to copy</strong>
              <span>{source.slotCount} slots</span>
            </div>
            <div className={styles.sourceDays}>
              <strong>{periodLabel(source)}</strong>
              <div className={styles.dayCounts}>
                {sourceDays.map((day) => (
                  <span key={day.date} title={day.date}>
                    <small>{formatDay(day.date).split(' ')[0]}</small>
                    {day.slotCount}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section aria-label="Continuation periods">
            <div className={styles.sectionTitle}>
              <strong>Copy it to one or more continuation periods</strong>
              <span>{selectedPeriods.length} selected</span>
            </div>
            <div className={styles.periods}>
              {destinations.map((period) => {
                const checked = selected.includes(period.from);
                const disabled = !period.canReplace;
                const reason = period.bookingCount > 0
                  ? `${period.bookingCount} booking${period.bookingCount === 1 ? '' : 's'} — cannot be replaced.`
                  : checked && period.slotCount > 0
                    ? `${period.slotCount} slot${period.slotCount === 1 ? '' : 's'} will be replaced by this copy.`
                    : period.slotCount > 0
                      ? `No bookings. ${period.slotCount} slot${period.slotCount === 1 ? '' : 's'} can be replaced.`
                      : 'Nothing to replace.';
                return (
                  <label key={period.from} className={`${styles.period} ${disabled ? styles.locked : ''} ${checked ? styles.checked : ''}`}>
                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onToggle(period)} />
                    <span className={styles.periodText}>
                      <strong>{periodLabel(period)}</strong>
                      <small className={checked && period.slotCount > 0 ? styles.replace : ''}>{reason}</small>
                    </span>
                    <span className={styles.slotCount}>{period.bookingCount > 0 ? `${period.bookingCount} bookings` : `${period.slotCount} slots`}</span>
                  </label>
                );
              })}
            </div>
            <Button variant="ghost" size="small" className={styles.more} disabled={isPending} onClick={onShowMore}>
              Show more periods
            </Button>
          </section>
        </>
      )}
    </Modal>
  );
}
