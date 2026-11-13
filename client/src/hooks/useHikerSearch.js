/**
 * HOOKS: "Find the hiker" of the New reservation page (story MH-07). The search starts as the
 * employee types, from the second character, a moment after the last key. It lists only hiker
 * accounts: temporary hikers and the staff are never found.
 *
 *   isActive     true when the text is long enough to search
 *   hikers       the hikers found for the text, or for the previous text while the new one is
 *                searching (so the list does not blink); null before the first answer
 *   isSearching  true while the answer for the current text has not come yet
 *   failure      null, 'login' (401: the page sends to the login) or the message to show
 */
import { useEffect, useState } from 'react';
import { searchHikers } from '../api/staff.js';
import { searchText } from '../lib/hikers.js';

const DEBOUNCE_MS = 250;
const GENERIC_ERROR = 'Something went wrong on our side. Try again in a minute.';
const STAFF_ONLY = 'Only the staff can look for a hiker.';

const toFailure = (error) => {
  if (error.status === 401) return 'login';
  return error.status === 403 ? STAFF_ONLY : GENERIC_ERROR;
};

export function useHikerSearch(query) {
  const text = searchText(query);
  // { text, hikers } or { text, failure }: the last answer of the server.
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (text === null) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      searchHikers(text).then(
        (hikers) => active && setResult({ text, hikers }),
        (error) => active && setResult({ text, failure: toFailure(error) }),
      );
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text]);

  if (text === null) return { isActive: false, hikers: null, isSearching: false, failure: null };
  const isCurrent = result?.text === text;
  return {
    isActive: true,
    hikers: result?.hikers ?? null,
    isSearching: !isCurrent,
    failure: isCurrent ? result.failure ?? null : null,
  };
}
