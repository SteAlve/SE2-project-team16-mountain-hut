/**
 * HOOKS: the confirmation of "Cancel booking" (story MH-08, mockup docs/mockups/hiker-booking-page, screen 11).
 * One instance for the booking whose dialog is open.
 *
 *   cancel()    sends DELETE /api/bookings/:id. Resolves to 'done' (the booking is cancelled: onCancelled runs),
 *               'login' (401: nobody is logged in), 'stale' (404 or 422: the booking is not there any more,
 *               onStale runs with the note) or 'failed' (anything else: the dialog stays open, with `error`)
 *   isPending   true while the request runs
 *   error       the note of a failed try, or null
 */
import { useState } from 'react';
import { cancelBooking } from '../api/bookings.js';
import { cancelFailure } from '../lib/cancelBooking.js';

export function useCancelBooking(booking, { onCancelled, onStale }) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);

  const cancel = async () => {
    setIsPending(true);
    setError(null);
    try {
      await cancelBooking(booking.id);
    } catch (failure) {
      if (failure.status === 401) {
        setIsPending(false);
        return 'login';
      }
      if (failure.status === 404 || failure.status === 422) {
        onStale(cancelFailure(failure));
        return 'stale';
      }
      setError(cancelFailure(failure));
      setIsPending(false);
      return 'failed';
    }
    onCancelled(booking);
    return 'done';
  };

  return { cancel, isPending, error };
}
