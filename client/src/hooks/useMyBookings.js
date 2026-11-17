/**
 * HOOKS: the "My bookings" page (story MH-06, mockup docs/mockups/hiker-booking-page).
 * Loads the bookings of the logged-in hiker and keeps the one being edited.
 *
 *   bookings        the bookings in order of day and time, or null while they load
 *   isLoading       true until the first answer
 *   alert           the message of a failed load, or null
 *   loggedOut       true when the server says nobody is logged in (401): the page goes to the login
 *   notice          the green note after a saved change, or null
 *   staleNote       the red note when an edit found the booking changed in the meantime, or null
 *   stale(message)  closes the dialog, keeps the note and loads the list again
 *   editing         the booking whose dialog is open, or null (it goes away if the list no longer has it)
 *   edit(booking), closeEdit()
 *   cancelling      the booking whose "Cancel this booking?" dialog is open (MH-08), or null
 *   cancel(booking), closeCancel()
 *   cancelled(booking)  the booking was cancelled: closes the dialog, takes it off the list at once, shows the note
 *                   and loads the list again
 *   reload()        loads the list again
 *   saved(booking)  a change was saved: closes the dialog, shows the note and loads the list again, so
 *                   the day, the tables and the deadline are the ones of the server
 */
import { useCallback, useEffect, useState } from 'react';
import { listMyBookings } from '../api/bookings.js';
import { cancelNotice } from '../lib/cancelBooking.js';
import { bookingReference } from '../lib/changeBooking.js';

const GENERIC_ERROR = 'Something went wrong on our side. Try again in a minute.';

export function useMyBookings() {
  const [bookings, setBookings] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [notice, setNotice] = useState(null);
  const [staleNote, setStaleNote] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  // Resolves to true when the list was loaded.
  const reload = useCallback(async () => {
    try {
      setBookings(await listMyBookings());
      setAlert(null);
      return true;
    } catch (error) {
      if (error.status === 401) setLoggedOut(true);
      else setAlert(error.status === 403 ? error.message : GENERIC_ERROR);
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    listMyBookings().then(
      (list) => { if (active) setBookings(list); },
      (error) => {
        if (!active) return;
        if (error.status === 401) setLoggedOut(true);
        else setAlert(error.status === 403 ? error.message : GENERIC_ERROR);
      },
    );
    return () => { active = false; };
  }, []);

  const saved = async (booking) => {
    setEditingId(null);
    setNotice(`Booking ${bookingReference(booking.id)} changed. We emailed you the new details.`);
    // Until the list arrives, the saved booking replaces the old one (the answer has no deadline).
    setBookings((current) => current?.map((b) => (b.id === booking.id ? { ...b, ...booking } : b)) ?? current);
    await reload();
  };

  // The booking is cancelled (MH-08): it leaves the list at once, then the list is loaded again.
  const cancelled = async (booking) => {
    setCancellingId(null);
    setStaleNote(null);
    setNotice(cancelNotice(booking.id));
    setBookings((current) => current?.filter((b) => b.id !== booking.id) ?? current);
    await reload();
  };

  // The booking changed or went away while it was edited or cancelled: close the dialog, say it and load the list again.
  const stale = (message) => {
    setEditingId(null);
    setCancellingId(null);
    setNotice(null);
    setStaleNote(message);
    reload();
  };

  return {
    bookings,
    isLoading: bookings === null && alert === null && !loggedOut,
    alert,
    loggedOut,
    notice,
    staleNote,
    editing: bookings?.find((b) => b.id === editingId) ?? null,
    cancelling: bookings?.find((b) => b.id === cancellingId) ?? null,
    edit: (booking) => { setNotice(null); setStaleNote(null); setEditingId(booking.id); },
    closeEdit: () => setEditingId(null),
    cancel: (booking) => { setNotice(null); setStaleNote(null); setCancellingId(booking.id); },
    closeCancel: () => setCancellingId(null),
    cancelled,
    reload,
    saved,
    stale,
  };
}
