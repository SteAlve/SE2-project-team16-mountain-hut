// The roles of the users.
export const ROLES = Object.freeze({
  HIKER: 'HIKER',
  EMPLOYEE: 'EMPLOYEE',
  WARDEN: 'WARDEN',
});

// The staff of the hut: the employees and the warden (who can do everything an employee can).
export const isStaff = (role) => role === ROLES.EMPLOYEE || role === ROLES.WARDEN;
