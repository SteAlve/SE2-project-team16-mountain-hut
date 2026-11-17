/**
 * The checks of the login, sign-up and password forms, run in the browser before sending
 * (docs/mockups/login/README.md, "Fields and rules"). The server checks them again.
 * Each function returns { field: message } for the fields that fail, in the order of the form.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d ]*\d[\d ]*$/;
const MIN_PASSWORD_LENGTH = 8;

const INVALID_EMAIL = 'Enter a valid email, like name@example.com.';
const SHORT_PASSWORD = 'Use at least 8 characters.';
const DIFFERENT_PASSWORDS = 'The passwords are different.';
// Also the answer of the server (422), which the page can tell before sending: the server compares
// the new password with the current one only once the current one is right.
export const SAME_PASSWORD = 'Choose a password different from the current one.';

const isBlank = (value) => value.trim() === '';
const isEmail = (value) => EMAIL.test(value.trim());

// Same rules and messages as the sign-up: what no account can have (an empty or malformed
// email, a short password) never reaches the server.
export function validateLogIn({ email, password }) {
  const errors = {};
  if (!isEmail(email)) errors.email = INVALID_EMAIL;
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = SHORT_PASSWORD;
  return errors;
}

export function validateSignUp({ firstName, lastName, email, phone, password, repeatPassword }) {
  const errors = {};
  if (isBlank(firstName)) errors.firstName = 'Enter your first name.';
  if (isBlank(lastName)) errors.lastName = 'Enter your last name.';
  if (!isEmail(email)) errors.email = INVALID_EMAIL;
  if (!isBlank(phone) && !PHONE.test(phone.trim())) errors.phone = 'Enter a valid phone number.';
  if (password.length < MIN_PASSWORD_LENGTH) errors.password = SHORT_PASSWORD;
  if (repeatPassword !== password) errors.repeatPassword = DIFFERENT_PASSWORDS;
  return errors;
}

// Forgot password (screen 10).
export function validateForgotPassword({ email }) {
  return isEmail(email) ? {} : { email: INVALID_EMAIL };
}

// Choose a new password, from the link of the email (screen 12).
export function validateNewPassword({ newPassword, repeatPassword }) {
  const errors = {};
  if (newPassword.length < MIN_PASSWORD_LENGTH) errors.newPassword = SHORT_PASSWORD;
  if (repeatPassword !== newPassword) errors.repeatPassword = DIFFERENT_PASSWORDS;
  return errors;
}

// Choose your password, at the first login (screens 15 and 17).
export function validateChangePassword({ currentPassword, newPassword, repeatPassword }) {
  const errors = {};
  if (currentPassword === '') errors.currentPassword = 'Enter the current password.';
  Object.assign(errors, validateNewPassword({ newPassword, repeatPassword }));
  if (!errors.currentPassword && !errors.newPassword && newPassword === currentPassword) {
    errors.newPassword = SAME_PASSWORD;
  }
  return errors;
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;
