// The menu of a slot (MH-10) with the slot it belongs to: a row of the slot dao (findMenuById,
// saveMenu, findPreviousMenus) as the use cases return it. menu is null when the slot has none.
export const describeSlotMenu = ({ slotId, serviceDate, startsAt, endsAt, menu }) => ({
  slotId,
  date: serviceDate,
  startsAt,
  endsAt,
  menu,
});

// When the staff can still change or delete the menu of a slot (product owner, PO issue 59 of the
// requirements repository): only before the slot starts. From its start on, the menu is the one the
// hikers had for that meal and stays as it is. The times arrive as parameters: domain/ never reads
// the clock.
export const isMenuOpen = (slotStartsAt, now) => now.getTime() < slotStartsAt.getTime();
