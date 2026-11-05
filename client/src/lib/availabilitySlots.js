/** Pure search rules for MH-04. Slot times are local to the hut on the same day. */
export function findSearchSlots(slots, from, to) {
  const overlapping = slots.filter((slot) => slot.startsAt.slice(0, 5) < to && slot.endsAt.slice(0, 5) > from);
  const candidates = overlapping.filter((slot) => slot.bookable);
  // A sole unavailable overlap is still checked so the server can explain its answer.
  const automatic = candidates.length === 1 ? candidates[0]
    : candidates.length === 0 && overlapping.length === 1 ? overlapping[0] : null;
  return { overlapping, candidates, automatic };
}
