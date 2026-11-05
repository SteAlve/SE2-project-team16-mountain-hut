/** Explain a rejected seating check without treating stale capacity as its cause. */
export function unavailableMessage(answer, partySize) {
  if (answer.message) return answer.message;
  const { error, latest, label } = answer;
  const freeSeats = latest?.freeSeats ?? answer.freeSeats;
  switch (error?.status) {
    case 404:
      return 'This meal time is no longer available.';
    case 422:
      if (latest?.bookingOpen === false) {
        const time = latest.bookingClosesAt?.slice(11, 16);
        return time ? `Closed at ${time}` : 'Booking for this meal time is closed.';
      }
      if (!latest && label?.startsWith('Closed')) return label;
      if (latest?.freeSeats === 0) return 'This time has no free seats.';
      return 'This meal time cannot be booked. Choose another time.';
    case 409:
      if (freeSeats === 0) return 'This time has no free seats.';
      if (Number.isFinite(freeSeats) && freeSeats > 0 && freeSeats < partySize) {
        return `This time has ${freeSeats} free seats, not enough for ${partySize} people.`;
      }
      return 'There are not enough free seats for your party. Availability may have changed.';
    default:
      return 'This meal time is currently unavailable.';
  }
}
