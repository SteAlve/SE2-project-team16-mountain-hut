/**
 * HOOKS: the "Register a hike" dialog (story MH-20, mockup docs/mockups/register-a-hike, screens 3-9).
 * It keeps every choice and sends nothing until `save`. The server decides; the client checks the same
 * rules (lib/hikes.js) only to say what is missing before sending.
 *
 *   values           { start (the hut until changed), destination, route, departureDay, departureTime, returnDay, returnTime }
 *   set(field, value) changes one value
 *   popularId        the popular hike chosen, or null; choosePopular(hike) fills the route, the passage points and
 *                    the destination (the times stay as they are)
 *   points           the passage points, in order: [{ id, text }]
 *   addPoint(), changePoint(id, text), removePoint(id)
 *   route            the dragging of the points: { attachList, scrollToEnd, drag, handleProps }, see useRouteDrag
 *   errors           the message under each field that needs attention, once a save was tried: { start, destination,
 *                    route, departure, return }. A departure in the past is one of them, also when the server says it (400)
 *   alert            the red note of the dialog when the server refused the hike, or null
 *   refused          true once a save was refused ("Nothing has been saved.")
 *   refusals         how many saves were refused so far: the dialog brings the first message into view each time
 *   isPending        true while the request runs
 *   stepsDone        which steps of the form are filled: { popular, when, route }
 *   save()           validates and sends POST /api/hikes. Resolves to 'done' (saved: onRegistered runs with the hike),
 *                    'invalid' (something is missing, nothing sent), 'login' (401: nobody is logged in)
 *                    or 'failed' (refused: `alert` says why and every choice is kept)
 */
import { useRef, useState } from 'react';
import { registerHike } from '../api/hikes.js';
import {
  buildHikeRequest,
  HUT_LABEL,
  isPastDepartureFailure,
  movePoint,
  PAST_DEPARTURE,
  POINTS_MAX,
  registerFailure,
  validateHike,
} from '../lib/hikes.js';
import { useRouteDrag } from './useRouteDrag.js';

const EMPTY = { start: HUT_LABEL, destination: '', route: '', departureDay: '', departureTime: '', returnDay: '', returnTime: '' };

export function useRegisterHike({ onRegistered }) {
  const [values, setValues] = useState(EMPTY);
  const [popularId, setPopularId] = useState(null);
  const [points, setPoints] = useState([]);
  const [tried, setTried] = useState(false);
  const [alert, setAlert] = useState(null);
  // The server said the departure is in the past: shown under the departure until it is changed.
  const [pastForServer, setPastForServer] = useState(false);
  const [refusals, setRefusals] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const lastId = useRef(0);
  const newPoint = (text = '') => ({ id: ++lastId.current, text });

  const route = useRouteDrag({
    count: points.length,
    onMove: (from, to) => setPoints((list) => movePoint(list, from, to)),
  });

  // The note of a refusal talks about the choices as they were: an edit takes it away.
  const set = (field, value) => {
    setAlert(null);
    if (field.startsWith('departure')) setPastForServer(false);
    setValues((current) => ({ ...current, [field]: value }));
  };

  const choosePopular = (hike) => {
    setAlert(null);
    setPopularId(hike.id);
    setValues((current) => ({ ...current, destination: hike.destination, route: hike.route }));
    setPoints(hike.passagePoints.map((text) => newPoint(text)));
  };

  const addPoint = () => {
    if (points.length >= POINTS_MAX) return;
    setAlert(null);
    setPoints((list) => [...list, newPoint()]);
    route.scrollToEnd();
  };

  const changePoint = (id, text) => {
    setAlert(null);
    setPoints((list) => list.map((point) => (point.id === id ? { ...point, text } : point)));
  };

  const removePoint = (id) => {
    setAlert(null);
    setPoints((list) => list.filter((point) => point.id !== id));
  };

  // Once a save was tried, the messages follow the form: they go away as each field is fixed.
  const checked = tried ? validateHike(values) : {};
  const errors = pastForServer && !checked.departure ? { ...checked, departure: PAST_DEPARTURE } : checked;

  const save = async () => {
    setTried(true);
    setAlert(null);
    if (Object.keys(validateHike(values)).length > 0) {
      setRefusals((count) => count + 1);
      return 'invalid';
    }
    setIsPending(true);
    try {
      const hike = await registerHike(buildHikeRequest(values, points));
      onRegistered(hike);
      return 'done';
    } catch (failure) {
      setIsPending(false);
      if (failure.status === 401) return 'login';
      setRefusals((count) => count + 1);
      if (isPastDepartureFailure(failure)) setPastForServer(true);
      else setAlert(registerFailure(failure));
      return 'failed';
    }
  };

  return {
    values,
    set,
    popularId,
    choosePopular,
    points,
    addPoint,
    changePoint,
    removePoint,
    canAddPoint: points.length < POINTS_MAX,
    route,
    errors,
    alert,
    refused: refusals > 0,
    refusals,
    isPending,
    stepsDone: {
      popular: popularId !== null,
      when: Boolean(values.departureDay && values.departureTime && values.returnDay && values.returnTime),
      route: values.route.trim() !== '',
    },
    save,
  };
}
