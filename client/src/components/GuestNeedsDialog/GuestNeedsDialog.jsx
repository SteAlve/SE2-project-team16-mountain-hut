/**
 * The popup with the needs of one line, over "Check your booking" (MH-05) and "Change your booking"
 * (MH-06): it opens on "+ Add a guest's needs" and on Edit of a line, and shows only that line.
 * The dialog under it renders it as a sibling, not inside itself, so its form and Esc stay its own.
 * Done folds the line when it is valid (otherwise the problems are marked and it stays open);
 * Cancel (or Esc) leaves the line as it was, and a line just added goes away.
 * `needs` is what hooks/useDietaryNeeds returns, with a line open; `partySize` sets the top of Guests.
 */
import { Button } from '../Button/Button.jsx';
import { GuestNeedsEditor } from '../GuestNeedsEditor/GuestNeedsEditor.jsx';
import { Modal } from '../Modal/Modal.jsx';

const NO_ERRORS = {};

export function GuestNeedsDialog({ needs, partySize, disabled }) {
  const line = needs.lines.find((l) => l.key === needs.openKey);
  if (!line) return null;
  const free = Math.max(partySize - needs.counted, 0);

  return (
    <Modal
      open
      wide
      titleId="guest-needs-title"
      title={needs.adding ? 'Add a guest’s needs' : 'Edit a guest’s needs'}
      subtitle="Guests with exactly the same needs share one line: set how many they are."
      isPending={disabled}
      onCancel={needs.cancel}
      onSubmit={needs.fold}
      actions={
        <>
          <Button variant="outline" size="small" disabled={disabled} onClick={needs.cancel}>
            Cancel
          </Button>
          <Button type="submit" size="small" disabled={disabled}>
            Done
          </Button>
        </>
      }
    >
      <GuestNeedsEditor
        line={line}
        maxGuests={line.guests + free}
        errors={needs.errors[line.key] ?? NO_ERRORS}
        disabled={disabled}
        onGuests={(n) => needs.setGuests(line.key, n)}
        onToggleDiet={(code) => needs.toggleDiet(line.key, code)}
        onToggleAllergy={(code) => needs.toggleAllergy(line.key, code)}
        onText={(field, value) => needs.setText(line.key, field, value)}
        onRemove={() => needs.remove(line.key)}
      />
    </Modal>
  );
}
