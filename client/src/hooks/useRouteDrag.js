/**
 * HOOKS: moving the passage points of a hike (story MH-20, mockup docs/mockups/register-a-hike, screen 5 and 9).
 * A point is dragged by its handle with the pointer (mouse, finger or pen); a line shows where it will land, and the
 * list scrolls by itself near its top or bottom edge. The handle also moves it with the arrow keys, for those who cannot drag.
 *
 *   attachList         the `ref` of the list of the points (the element that scrolls); its rows have `data-point`
 *                      and their handles `data-handle`
 *   scrollToEnd()      scrolls the list to its end and puts the cursor in its last point
 *   drag               { from, insertAt } while a point is dragged, else null; insertAt is the place the line shows
 *   handleProps(index) the props of the handle of the point at `index`
 * `onMove(from, to)` is called when a point is dropped somewhere else, or moved with a key.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { dropTarget, insertIndex } from '../lib/hikes.js';

const EDGE_PX = 28; // the distance from the edge of the list where it starts to scroll
const MAX_SPEED = 14; // px per frame

export function useRouteDrag({ count, onMove }) {
  const listRef = useRef(null);
  const attachList = useCallback((element) => {
    listRef.current = element;
  }, []);
  const current = useRef(null); // the same as `drag`, but readable at once inside an event
  const pointerY = useRef(0);
  const [drag, setDrag] = useState(null);

  const set = useCallback((value) => {
    current.current = value;
    setDrag(value);
  }, []);

  // The place the line shows for the pointer at `y`.
  const insertAtY = useCallback((y) => {
    const rows = [...(listRef.current?.querySelectorAll('[data-point]') ?? [])].map((row) => {
      const { top, height } = row.getBoundingClientRect();
      return { top, height };
    });
    return insertIndex(y, rows);
  }, []);

  const follow = useCallback(() => {
    const active = current.current;
    if (!active) return;
    const insertAt = insertAtY(pointerY.current);
    if (insertAt !== active.insertAt) set({ ...active, insertAt });
  }, [insertAtY, set]);

  // While a point is dragged, the list scrolls when the pointer is near its edge.
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return undefined;
    let frame = requestAnimationFrame(function scroll() {
      const list = listRef.current;
      if (list) {
        const { top, bottom } = list.getBoundingClientRect();
        const y = pointerY.current;
        const speed = y < top + EDGE_PX ? -Math.min(1, (top + EDGE_PX - y) / EDGE_PX) : y > bottom - EDGE_PX ? Math.min(1, (y - (bottom - EDGE_PX)) / EDGE_PX) : 0;
        if (speed !== 0) {
          list.scrollTop += speed * MAX_SPEED;
          follow();
        }
      }
      frame = requestAnimationFrame(scroll);
    });
    return () => cancelAnimationFrame(frame);
  }, [dragging, follow]);

  const handleProps = (index) => ({
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pointerY.current = event.clientY;
      set({ from: index, insertAt: index });
    },
    onPointerMove: (event) => {
      if (!current.current) return;
      pointerY.current = event.clientY;
      follow();
    },
    onPointerUp: () => {
      const active = current.current;
      set(null);
      if (!active) return;
      const to = dropTarget(active.from, active.insertAt);
      if (to !== active.from) onMove(active.from, to);
    },
    // The browser took the pointer (a scroll, a call...): nothing moves.
    onPointerCancel: () => set(null),
    onKeyDown: (event) => {
      const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : null;
      if (to === null) return;
      event.preventDefault();
      if (to < 0 || to >= count) return;
      onMove(index, to);
      // The handle keeps the focus, so the next key moves the same point again.
      requestAnimationFrame(() => listRef.current?.querySelectorAll('[data-handle]')[to]?.focus());
    },
  });

  // After a point is added: the list shows it, ready to be typed.
  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      const list = listRef.current;
      if (!list) return;
      list.scrollTop = list.scrollHeight;
      list.querySelector('[data-point]:last-child input')?.focus();
    });
  };

  return { attachList, scrollToEnd, drag, handleProps };
}
