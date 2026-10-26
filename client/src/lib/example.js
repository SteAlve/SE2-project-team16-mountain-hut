/**
 * LIB: here go small pure functions that format data for the screens.
 * Not here: React, fetch, business rules (the server decides).
 *
 * THE CODE BELOW IS JUST AN EXAMPLE (story MH-04: how a party would be seated).
 * Delete this file when the first real one exists.
 */
export const formatSeatSplit = (tables) => tables.map((table) => table.seats).join(' + ');
