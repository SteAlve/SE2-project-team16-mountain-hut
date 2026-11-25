// The menu of a slot (MH-10) with the slot it belongs to: a row of the slot dao (findMenuById,
// saveMenu, findPreviousMenus) as the use cases return it. menu is null when the slot has none.
export const describeSlotMenu = ({ slotId, serviceDate, startsAt, endsAt, menu }) => ({
  slotId,
  date: serviceDate,
  startsAt,
  endsAt,
  menu,
});
