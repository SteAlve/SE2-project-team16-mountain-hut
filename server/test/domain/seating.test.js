import { describe, expect, it } from 'vitest';
import { assignSeats, describeSeating } from '../../src/domain/seating.js';

const tables = (...free) => free.map((freeSeats, index) => ({ tableId: index + 1, freeSeats }));

describe('assignSeats: one table', () => {
  it('uses the table with the fewest free seats that still fits (best fit)', () => {
    expect(assignSeats(2, tables(4, 6, 2))).toEqual([{ tableId: 3, seatCount: 2 }]);
    expect(assignSeats(3, tables(4, 6, 2))).toEqual([{ tableId: 1, seatCount: 3 }]);
  });

  it('shares a table: only the free seats count', () => {
    expect(assignSeats(2, [{ tableId: 7, freeSeats: 2 }])).toEqual([{ tableId: 7, seatCount: 2 }]);
  });

  it('chooses one of the equally good tables when their free seats tie', () => {
    const assignments = assignSeats(3, [
      { tableId: 9, freeSeats: 4 },
      { tableId: 5, freeSeats: 4 },
    ]);

    expect(assignments).toHaveLength(1);
    const [assignment] = assignments;
    expect([5, 9]).toContain(assignment.tableId);
    expect(assignment.seatCount).toBe(3);
  });

  it('keeps the party together even when splitting would use fewer seats', () => {
    // 5 people: one table of 6 (not 3 + 2 on two tables)
    expect(assignSeats(5, tables(3, 2, 6))).toEqual([{ tableId: 3, seatCount: 5 }]);
  });
});

describe('assignSeats: split', () => {
  it('accepts any optimal pair when several pairs have the same free seats', () => {
    const layout = [
      { tableId: 90, freeSeats: 3 },
      { tableId: 12, freeSeats: 3 },
      { tableId: 47, freeSeats: 3 },
    ];
    for (const ordered of [layout, [...layout].reverse()]) {
      const result = assignSeats(5, ordered);
      expect(result).toHaveLength(2);
      expect(new Set(result.map((a) => a.tableId)).size).toBe(2);
      expect(result.reduce((sum, a) => sum + a.seatCount, 0)).toBe(5);
      for (const assignment of result) {
        expect(layout.map((t) => t.tableId)).toContain(assignment.tableId);
        expect(assignment.seatCount).toBeGreaterThan(0);
        expect(assignment.seatCount).toBeLessThanOrEqual(3);
      }
    }
  });

  it('splits only when no single table fits, over the fewest tables', () => {
    const layout = tables(3, 3, 1, 1);
    const assignments = assignSeats(5, layout);

    expect(assignments).toHaveLength(2);
    expect(assignments.reduce((sum, assignment) => sum + assignment.seatCount, 0)).toBe(5);
    for (const assignment of assignments) {
      expect(assignment.seatCount).toBeLessThanOrEqual(layout[assignment.tableId - 1].freeSeats);
    }
  });

  it('assigns the full party across tables without exceeding their free seats', () => {
    const layout = tables(2, 2, 2);
    const assignments = assignSeats(5, layout);

    expect(assignments).toHaveLength(3);
    expect(assignments.reduce((sum, assignment) => sum + assignment.seatCount, 0)).toBe(5);
    for (const assignment of assignments) {
      expect(assignment.seatCount).toBeGreaterThan(0);
      expect(assignment.seatCount).toBeLessThanOrEqual(layout[assignment.tableId - 1].freeSeats);
    }
  });

  it('among the groups with the fewest tables takes the one that leaves the fewest seats free', () => {
    // 8 people: 6 + 5 would leave 3 free, 5 + 3 leaves none
    expect(assignSeats(8, tables(6, 5, 3))).toEqual([
      { tableId: 2, seatCount: 5 },
      { tableId: 3, seatCount: 3 },
    ]);
  });

  it('seats a party that needs every free seat', () => {
    expect(assignSeats(6, tables(2, 2, 2))).toEqual([
      { tableId: 1, seatCount: 2 },
      { tableId: 2, seatCount: 2 },
      { tableId: 3, seatCount: 2 },
    ]);
  });
});

describe('assignSeats: no place', () => {
  it('gives null when the free seats are fewer than the party', () => {
    expect(assignSeats(5, tables(2, 2))).toBeNull();
    expect(assignSeats(1, [])).toBeNull();
  });

  it('ignores tables with no free seat', () => {
    expect(assignSeats(2, tables(0, 0, 2))).toEqual([{ tableId: 3, seatCount: 2 }]);
    expect(assignSeats(1, tables(0, 0))).toBeNull();
  });
});

describe('assignSeats: against every possible choice', () => {
  const subsets = (list) => list.reduce((all, item) => [...all, ...all.map((s) => [...s, item])], [[]]);

  it('uses the fewest tables and the fewest total free seats, on random layouts', () => {
    let seed = 12345;
    const random = (max) => {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      return (seed % max) + 1;
    };

    for (let round = 0; round < 300; round += 1) {
      const layout = Array.from({ length: random(6) }, (_, i) => ({
        tableId: 10 + i * 7,
        freeSeats: random(7) - 1,
      }));
      const original = layout.map((table) => ({ ...table }));
      const total = layout.reduce((sum, t) => sum + t.freeSeats, 0);
      const partySize = random(total + 2);
      const result = assignSeats(partySize, layout);
      expect(layout).toEqual(original);

      if (partySize > total) {
        expect(result).toBeNull();
        continue;
      }

      const free = new Map(layout.map((t) => [t.tableId, t.freeSeats]));
      expect(new Set(result.map((a) => a.tableId)).size).toBe(result.length);
      expect(result.reduce((sum, a) => sum + a.seatCount, 0)).toBe(partySize);
      for (const { tableId, seatCount } of result) {
        expect(free.has(tableId)).toBe(true);
        expect(Number.isInteger(seatCount)).toBe(true);
        expect(seatCount).toBeGreaterThan(0);
        expect(seatCount).toBeLessThanOrEqual(free.get(tableId));
      }

      const fitting = layout.filter((t) => t.freeSeats >= partySize);
      if (fitting.length > 0) {
        expect(result).toHaveLength(1);
        expect(free.get(result[0].tableId)).toBe(Math.min(...fitting.map((t) => t.freeSeats)));
        continue;
      }

      const groups = subsets(layout).filter((g) => g.reduce((s, t) => s + t.freeSeats, 0) >= partySize);
      const fewest = Math.min(...groups.map((g) => g.length));
      const leastSeats = Math.min(
        ...groups.filter((g) => g.length === fewest).map((g) => g.reduce((s, t) => s + t.freeSeats, 0)),
      );
      expect(result).toHaveLength(fewest);
      expect(result.reduce((s, a) => s + free.get(a.tableId), 0)).toBe(leastSeats);
    }
  });
});

describe('describeSeating', () => {
  it('writes the table numbers, ordered by number', () => {
    const layout = [
      { tableId: 90, tableNumber: 5, freeSeats: 2 },
      { tableId: 12, tableNumber: 3, freeSeats: 4 },
    ];
    expect(describeSeating([{ tableId: 90, seatCount: 2 }, { tableId: 12, seatCount: 4 }], layout))
      .toEqual([{ tableNumber: 3, seats: 4 }, { tableNumber: 5, seats: 2 }]);
  });
});
