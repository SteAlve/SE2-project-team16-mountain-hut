/**
 * HOOKS: the "My hikes" page (story MH-20, mockup docs/mockups/register-a-hike).
 * Loads the hikes of the logged-in hiker and keeps the "Register a hike" dialog.
 *
 *   hikes        the hikes in order of departure, or null while they load
 *   isLoading    true until the first answer
 *   alert        the message of a failed load, or null
 *   loggedOut    true when the server says nobody is logged in (401): the page goes to the login
 *   notice       the note after a registration, or null
 *   newHikeId    the id of the hike just registered, or null: its card shows its passage points open
 *   registering  true while the dialog is open; openRegister(), closeRegister()
 *   registered(hike, email)  a hike was saved: closes the dialog, puts it in its place in the list at once, shows the
 *                note and loads the list again, so the list is the server's
 *   reload()     loads the list again; only the last load counts, so an older answer that arrives late does not bring
 *                back an old list
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listMyHikes } from '../api/hikes.js';
import { GENERIC } from '../lib/changeBooking.js';
import { registeredNotice, sortHikes } from '../lib/hikes.js';

export function useMyHikes() {
  const [hikes, setHikes] = useState(null);
  const [alert, setAlert] = useState(null);
  const [loggedOut, setLoggedOut] = useState(false);
  const [notice, setNotice] = useState(null);
  const [newHikeId, setNewHikeId] = useState(null);
  const [registering, setRegistering] = useState(false);
  // The number of the last load asked for: an answer of an older one is ignored.
  const lastLoad = useRef(0);

  // Resolves to true when this call loaded the list, false when it failed or a newer load replaced it.
  const reload = useCallback(async () => {
    const mine = ++lastLoad.current;
    try {
      const list = await listMyHikes();
      if (mine !== lastLoad.current) return false;
      setHikes(list);
      setAlert(null);
      return true;
    } catch (error) {
      if (mine !== lastLoad.current) return false;
      if (error.status === 401) setLoggedOut(true);
      else setAlert(error.status === 403 ? error.message : GENERIC);
      return false;
    }
  }, []);

  useEffect(() => {
    const load = lastLoad;
    const mine = ++load.current;
    listMyHikes().then(
      (list) => { if (mine === load.current) setHikes(list); },
      (error) => {
        if (mine !== load.current) return;
        if (error.status === 401) setLoggedOut(true);
        else setAlert(error.status === 403 ? error.message : GENERIC);
      },
    );
    // After the page is left no answer is wanted any more.
    return () => { load.current += 1; };
  }, []);

  const registered = async (hike, email) => {
    setRegistering(false);
    setNotice(registeredNotice(hike, email));
    setNewHikeId(hike.id);
    setHikes((current) => sortHikes([...(current ?? []), hike]));
    await reload();
  };

  return {
    hikes,
    isLoading: hikes === null && alert === null && !loggedOut,
    alert,
    loggedOut,
    notice,
    newHikeId,
    registering,
    openRegister: () => { setNotice(null); setRegistering(true); },
    closeRegister: () => setRegistering(false),
    registered,
    reload,
  };
}
