/**
 * HOOKS: the dietary needs and allergies of the party, in "Check your booking" (story MH-05,
 * mockup docs/mockups/dietary). The lines live here, outside the dialog, so Back and a failed
 * booking keep them.
 *
 *   lines                  the lines, in the order they were added (see lib/dietaryNeeds.js)
 *   openKey                the key of the line being edited, or null: only one is open at a time
 *   counted                the guests counted in all the lines; tooMany when more than the party
 *   errors                 { [key]: lineErrors } of the lines checked by Confirm, only the wrong ones
 *   add()                  a new line of 1 guest, open; folds the one being edited
 *   open(key), remove(key)
 *   setGuests(key, n)      from 1, up to the guests not counted yet
 *   toggleDiet(key, code), toggleAllergy(key, code)
 *   setText(key, field, value)   field is 'otherDiet', 'otherAllergy' or 'otherRequests'
 *   check()                before Confirm: marks the wrong lines and opens the first one;
 *                          true when the needs can be sent
 *   requirements           the lines as the API wants them, one requirement per guest
 *   reset()                no lines, for the next booking
 */
import { useRef, useState } from 'react';
import {
  countGuests,
  emptyLine,
  isValidLine,
  lineErrors,
  toggleAllergy,
  toggleDiet,
  toRequirements,
} from '../lib/dietaryNeeds.js';

export function useDietaryNeeds(partySize) {
  const [lines, setLines] = useState([]);
  const [openKey, setOpenKey] = useState(null);
  // Lines checked by a Confirm show their errors while they are fixed; a new line starts clean.
  const [checkedKeys, setCheckedKeys] = useState(() => new Set());
  const nextKey = useRef(1);

  const counted = countGuests(lines);
  const free = partySize - counted;
  const tooMany = free < 0;

  const update = (key, change) => setLines((current) => current.map((line) => (line.key === key ? change(line) : line)));

  const add = () => {
    if (free <= 0) return;
    const key = nextKey.current++;
    setLines((current) => [...current, emptyLine(key)]);
    setOpenKey(key);
  };

  const remove = (key) => {
    setLines((current) => current.filter((line) => line.key !== key));
    setOpenKey((open) => (open === key ? null : open));
  };

  // Lowering is always allowed (also when the party became smaller), raising only into free places.
  const setGuests = (key, n) =>
    update(key, (line) => ({
      ...line,
      guests: n <= line.guests ? Math.max(1, n) : Math.min(n, line.guests + Math.max(free, 0)),
    }));

  const check = () => {
    setCheckedKeys(new Set(lines.map((line) => line.key)));
    const wrong = lines.find((line) => !isValidLine(line));
    if (wrong) setOpenKey(wrong.key);
    return !wrong && !tooMany;
  };

  const reset = () => {
    setLines([]);
    setOpenKey(null);
    setCheckedKeys(new Set());
  };

  const errors = Object.fromEntries(
    lines
      .filter((line) => checkedKeys.has(line.key) && !isValidLine(line))
      .map((line) => [line.key, lineErrors(line)]),
  );

  return {
    lines,
    openKey,
    counted,
    tooMany,
    errors,
    add,
    open: setOpenKey,
    remove,
    setGuests,
    toggleDiet: (key, code) => update(key, (line) => toggleDiet(line, code)),
    toggleAllergy: (key, code) => update(key, (line) => toggleAllergy(line, code)),
    setText: (key, field, value) => update(key, (line) => ({ ...line, [field]: value })),
    check,
    requirements: toRequirements(lines),
    reset,
  };
}
