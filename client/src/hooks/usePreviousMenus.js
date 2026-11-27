/**
 * HOOKS: the menus already written, to start a new one from (MH-10, mockup docs/mockups/menus, step 5).
 * Loads them while `enabled` (a menu dialog is open), newest first, leaving out the slot being written.
 *
 *   hasAny               whether there is any previous menu at all for this slot (null while its first
 *                        page loads): with none, the box "Start from a previous menu" is not shown
 *   search, setSearch    the text of "Search the menus": the list follows it after a short pause
 *   query                the search the list shows (the text, once the pause is over)
 *   menus                [{ slotId, date, startsAt, endsAt, menu }] loaded so far; null while loading
 *   hasMore, showMore()  "Show older menus" loads the next page
 *   failed               true when the server could not answer
 *
 * A 401 calls onNeedsLogin.
 */
import { useEffect, useState } from 'react';
import { getPreviousMenus } from '../api/staff.js';

const PAGE = 10;
const SEARCH_PAUSE_MS = 250;

export function usePreviousMenus({ exceptSlotId, enabled, onNeedsLogin }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  // { key, menus, hasMore }: what is loaded for `key` (the slot and the search).
  const [loaded, setLoaded] = useState(null);
  // { exceptSlotId, value }: the answer belongs to the slot it was loaded for, so opening the editor of
  // another slot does not show the box of the previous one while its first page loads.
  const [any, setAny] = useState(null);
  const [failed, setFailed] = useState(false);
  const key = `${exceptSlotId}|${query}`;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const fail = (error) => {
    if (error.status === 401) onNeedsLogin();
    else setFailed(true);
  };

  // The first page, again at every new search.
  useEffect(() => {
    if (!enabled) return undefined;
    let current = true;
    getPreviousMenus({ exceptSlotId, search: query, limit: PAGE, offset: 0 }).then(
      ({ menus, hasMore }) => {
        if (!current) return;
        setFailed(false);
        setLoaded({ key: `${exceptSlotId}|${query}`, menus, hasMore });
        if (query === '') setAny({ exceptSlotId, value: menus.length > 0 });
      },
      (error) => {
        if (!current) return;
        if (error.status === 401) onNeedsLogin();
        else setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, [enabled, exceptSlotId, query, onNeedsLogin]);

  const current = loaded?.key === key ? loaded : null;
  const hasAny = any?.exceptSlotId === exceptSlotId ? any.value : null;

  const showMore = () => {
    if (!current) return;
    getPreviousMenus({ exceptSlotId, search: query, limit: PAGE, offset: current.menus.length }).then(
      ({ menus, hasMore }) => setLoaded((now) => (now?.key === key
        ? { key, menus: [...now.menus, ...menus.filter((m) => !now.menus.some((n) => n.slotId === m.slotId))], hasMore }
        : now)),
      fail,
    );
  };

  return {
    hasAny,
    search,
    setSearch,
    query,
    menus: current?.menus ?? null,
    hasMore: current?.hasMore ?? false,
    showMore,
    failed,
  };
}
