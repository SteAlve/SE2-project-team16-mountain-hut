// Table sets: the tables of a slot, each with its number and its seats (capacity).

// The seats of all the tables of a set.
export const totalSeats = (tables) => tables.reduce((sum, table) => sum + table.capacity, 0);

// A table set as the API shows it: with its tables in order of number, and the seats it has.
export const describeTableSet = ({ tableSetId, name, tables }) => ({
  tableSetId,
  name,
  tables: [...tables].sort((a, b) => a.tableNumber - b.tableNumber),
  totalSeats: totalSeats(tables),
});

// A slot as the staff sees it (a row of the slot dao). `tableSet` is the described table set, or null when the slot has none.
export const describeStaffSlot = ({ slotId, serviceDate, startsAt, endsAt }, tableSet) => ({
  slotId,
  date: serviceDate,
  startsAt,
  endsAt,
  tableSet,
  totalSeats: tableSet === null ? 0 : tableSet.totalSeats,
});
