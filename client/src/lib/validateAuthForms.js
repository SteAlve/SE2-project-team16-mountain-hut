/**
 * The checks of the login and sign-up forms, run in the browser before sending
 * (docs/mockups/login/README.md, "Fields and rules"). The server checks them again.
 * Each function returns { field: message } for the fields that fail, in the order of the form.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d ]*\d[\d ]*$/;
const MIN_PASSWORD_LENGTH = 8;

const INVALID_EMAIL = 'Enter a valid email, like name@example.com.';
const SHORT_PASSWORD = 'Use at least 8 characters.';

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
  if (repeatPassword !== password) errors.repeatPassword = 'The passwords are different.';
  return errors;
}

export const hasErrors = (errors) => Object.keys(errors).length > 0;
