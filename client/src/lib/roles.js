/**
 * LIB: the roles a user can have, as the server sends them in `user.role`, and what each one sees:
 * its name in the app, the pages in its navbar and the page it starts from after login
 * (docs/mockups/login/README.md, "Behaviour").
 */
export const ROLES = Object.freeze({
  HIKER: 'HIKER',
  EMPLOYEE: 'EMPLOYEE',
  WARDEN: 'WARDEN',
});

export const STAFF_ROLES = Object.freeze([ROLES.EMPLOYEE, ROLES.WARDEN]);

export const ROLE_LABEL = Object.freeze({
  [ROLES.HIKER]: 'Hiker',
  [ROLES.EMPLOYEE]: 'Employee',
  [ROLES.WARDEN]: 'Warden',
});

export const PAGES = Object.freeze({
  hut: { path: '/', label: 'The hut' },
  book: { path: '/book', label: 'Book a table' },
  slots: { path: '/slots', label: 'Slots & tables' },
});

// Only the pages that exist in sprint 1: later stories add theirs.
export const NAV_PAGES = Object.freeze({
  [ROLES.HIKER]: [PAGES.hut, PAGES.book],
  [ROLES.EMPLOYEE]: [PAGES.hut, PAGES.slots],
  [ROLES.WARDEN]: [PAGES.hut, PAGES.slots],
});

export const START_PAGE = Object.freeze({
  [ROLES.HIKER]: PAGES.book,
  [ROLES.EMPLOYEE]: PAGES.slots,
  [ROLES.WARDEN]: PAGES.slots,
});
