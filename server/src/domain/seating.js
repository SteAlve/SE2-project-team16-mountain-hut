/**
 * Where a party sits (MH-01), a pure function.
 *
 * The rule of the story:
 *   1. If one table has enough free seats, the whole party sits there. Of those tables the one with
 *      the fewest free seats is taken (best fit); on a tie, the lowest table id.
 *   2. Otherwise the party is split over as few tables as possible. Among the groups with that number
 *      of tables that can hold the party, the one with the fewest free seats in total is taken, so
 *      the fewest seats are left over; on a tie the result is still always the same.
 *      The seats are given to the biggest free tables first, and the last table gets the rest.
 *   3. If the free seats of all the tables are fewer than the party, there is no place: null.
 *
 * tables:  [{ tableId, freeSeats }]   result: [{ tableId, seatCount }] sorted by tableId, or null
 */

const byFreeSeatsThenId = (a, b) => a.freeSeats - b.freeSeats || a.tableId - b.tableId;

// The fewest tables whose free seats add up to the party: take the biggest ones until it is covered.
const fewestTablesNeeded = (partySize, tables) => {
  const biggestFirst = [...tables].sort((a, b) => b.freeSeats - a.freeSeats);
  let seats = 0;
  for (let count = 1; count <= biggestFirst.length; count += 1) {
    seats += biggestFirst[count - 1].freeSeats;
    if (seats >= partySize) return count;
  }
  return null;
};

// Among the groups of exactly `count` tables, the one with the smallest total of free seats that is
// still at least the party (a knapsack over the number of tables and the seats).
const tightestGroup = (partySize, tables, count) => {
  const items = [...tables].sort((a, b) => a.tableId - b.tableId);
  const total = items.reduce((sum, table) => sum + table.freeSeats, 0);
  // firstItem[c][s]: the first table that made "c tables with s seats" possible (-1: not possible)
  const firstItem = Array.from({ length: count + 1 }, () => new Array(total + 1).fill(-1));
  const possible = Array.from({ length: count + 1 }, () => new Array(total + 1).fill(false));
  possible[0][0] = true;

  items.forEach((table, index) => {
    for (let c = count; c >= 1; c -= 1) {
      for (let s = total; s >= table.freeSeats; s -= 1) {
        if (!possible[c][s] && possible[c - 1][s - table.freeSeats]) {
          possible[c][s] = true;
          firstItem[c][s] = index;
        }
      }
    }
  });

  let seats = partySize;
  while (seats <= total && !possible[count][seats]) seats += 1;
  if (seats > total) return null;

  const group = [];
  for (let c = count; c >= 1; c -= 1) {
    const item = items[firstItem[c][seats]];
    group.push(item);
    seats -= item.freeSeats;
  }
  return group;
};

export function assignSeats(partySize, tables) {
  const open = tables.filter((table) => table.freeSeats > 0);

  const fitting = open.filter((table) => table.freeSeats >= partySize).sort(byFreeSeatsThenId);
  if (fitting.length > 0) return [{ tableId: fitting[0].tableId, seatCount: partySize }];

  const count = fewestTablesNeeded(partySize, open);
  if (count === null) return null;

  const group = tightestGroup(partySize, open, count)
    .sort((a, b) => b.freeSeats - a.freeSeats || a.tableId - b.tableId);

  let toSeat = partySize;
  const assignments = [];
  for (const table of group) {
    const seatCount = Math.min(table.freeSeats, toSeat);
    if (seatCount > 0) assignments.push({ tableId: table.tableId, seatCount });
    toSeat -= seatCount;
  }
  return assignments.sort((a, b) => a.tableId - b.tableId);
}
