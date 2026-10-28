# Login and sign-up mockup (MH-45)

Mockup for the login frontend ([MH-55](https://polito-se2-26-16.youtrack.cloud/issue/MH-55)), the backend authentication ([MH-49](https://polito-se2-26-16.youtrack.cloud/issue/MH-49)) and their tests ([MH-58](https://polito-se2-26-16.youtrack.cloud/issue/MH-58), [MH-72](https://polito-se2-26-16.youtrack.cloud/issue/MH-72)).

**Figma (source of truth):** [Mountain Hut – Mockups (Team 16)](https://www.figma.com/design/VlTombwHX1DQ7yB2x4U5Yx)

| Figma page | What it holds |
|---|---|
| **Brand · QUOTA** | Name, logo, palette, typography, motifs and usage rules |
| **MH-45 Login & sign-up** | The 12 desktop screens and the 15 phone screens below |
| **Components** | Logo, trail blaze, button, text field, alert, navbars, brand panel, phone browser bar and top bar, and the colour variables |

## The brand in one paragraph

The app is called **QUOTA**. In Italian *quota* is altitude (huts are signed "quota 2.450 m"); in English a quota is a fixed number of places, which is what the app manages: the seats of each meal slot. The logo is a Q holding a peak, with a red-white-red trail blaze as its tail. Colours: dark pine and snow, with the blaze red used only for the brand. Fonts (all free on Google Fonts): **Barlow Condensed** for headings and big numbers, **Barlow** for text, **IBM Plex Mono** for times, seats and coordinates.

## Screens

| # | Screen | Image |
|---|---|---|
| 1 | Login | ![Login](01-login.png) |
| 2 | Login, fields left empty | ![Login with empty fields](02-login-empty-fields.png) |
| 3 | Login, wrong email or password | ![Login with wrong credentials](03-login-wrong-credentials.png) |
| 4 | Login needed first (redirect from a protected page) | ![Login required](04-login-required.png) |
| 5 | Sign up, hikers only | ![Sign up](05-signup.png) |
| 6 | Sign up, errors | ![Sign up errors](06-signup-errors.png) |
| 7 | Navbar for each role, and a hiker on a staff page | ![Navbar per role](07-navbar-per-role.png) |
| 8 | Forgot password | ![Forgot password](08-forgot-password.png) |
| 9 | Check your email | ![Check your email](09-check-your-email.png) |
| 10 | Choose a new password | ![New password](10-new-password.png) |
| 11 | Reset link expired or already used | ![Link expired](11-link-expired.png) |
| 12 | Password changed, back to the login | ![Password changed](12-password-changed.png) |

Login and sign-up are split screens: the **brand panel** on the left (hut name and altitude on a contour map), the form on the right.

The navbar shows only the pages that exist in sprint 1: *The hut* and *Book a table* for hikers, *The hut* and *Slots & tables* for employees and the manager. Pages of later stories are added to the navbar with their story.

## On a phone

The same website opened in a phone browser, not a separate app: the React pages are the same, and the CSS rearranges them. The screens are in Figma (section *On a phone* of the MH-45 page); [phone.html](phone.html) shows them in a browser with their notes.

- **Breakpoint: 992 px** (react-bootstrap `lg`). Below it the page is one column and the navbar collapses into a menu button (`Navbar expand="lg"`). Between 576 and 991 px (tablets) the form keeps a maximum width of 440 px, centred.
- **Login:** the brand panel becomes a dark header with the logo, "No account? Sign up", the hut name and the altitude; the form slides over it as a white sheet.
- **Sign up:** the header shrinks to the logo and the hut name. Fields that sit side by side on desktop (first and last name, the two passwords) are stacked.
- **Fields:** 16 px text, so iPhones do not zoom in when a field is tapped. Email uses `type="email"`, phone `type="tel"`, so the phone shows the right keyboard.
- **Menu:** shows who is logged in, the pages of that role (current page highlighted) and Log out. Tapping a link or outside the menu closes it.
- Texts, fields, rules and messages are the same as on desktop.

| # | Screen | Image |
|---|---|---|
| 1 | Login | ![Login on a phone](phone/01-login.png) |
| 2 | Login, fields left empty | ![Empty fields on a phone](phone/02-login-empty-fields.png) |
| 3 | Login, wrong email or password (focus back on the password) | ![Wrong credentials on a phone](phone/03-login-wrong-credentials.png) |
| 4 | Login needed first, while logging in | ![Login required on a phone](phone/04-login-required.png) |
| 5 | Sign up (full page, it scrolls) | ![Sign up on a phone](phone/05-signup.png) |
| 6 | Sign up, errors (the page scrolls to the first error) | ![Sign up errors on a phone](phone/06-signup-errors.png) |
| 7 | Menu, hiker | ![Hiker menu](phone/07-menu-hiker.png) |
| 8 | Menu, employee | ![Employee menu](phone/08-menu-employee.png) |
| 9 | Menu, manager | ![Manager menu](phone/09-menu-manager.png) |
| 10 | Staff only | ![Staff only on a phone](phone/10-staff-only.png) |
| 11 | Forgot password | ![Forgot password on a phone](phone/11-forgot-password.png) |
| 12 | Check your email | ![Check your email on a phone](phone/12-check-your-email.png) |
| 13 | New password | ![New password on a phone](phone/13-new-password.png) |
| 14 | Link expired | ![Link expired on a phone](phone/14-link-expired.png) |
| 15 | Password changed | ![Password changed on a phone](phone/15-password-changed.png) |

## Behaviour

- **One login for every role.** Hikers, employees and the manager log in on the same page with email and password. *Manager* is the name the app shows for the role the stories call *warden*.
- **Only hikers sign up.** Employee and manager accounts are created by the team (seed data in sprint 1). A hiker created by an employee over the phone is MH-7, not this page.
- **After login:** a hiker goes to *Book a table*; an employee or the manager goes to *Slots & tables*. If the user came from a protected page (screen 4), send them back there instead.
- **The blue note on screen 4** ("Log in to book a table.") is shown only when a user who is not logged in opens a protected page and is sent to the login. It says why they landed on the login instead of the page they clicked; without it the jump looks like an error. Opening the login page directly shows no note.
- **After sign-up:** the hiker is logged in straight away and goes to *Book a table*.
- **Forgot password:** the hiker resets the password alone, with a link sent by email (screens 8–12). Passwords are stored only as hashes: nobody, the hut staff included, can read or set them.
- **Log out** is in the navbar for every role and goes back to the public hut page.
- **The navbar shows only the pages that role can use** (screen 7). A hiker who opens a staff page by URL sees the "Staff only" page.
- **While the request is running** the button is disabled and reads "Logging in…" or "Creating account…".

## Fields and rules

### Login

| Field | Required | Rule | Message under the field |
|---|---|---|---|
| Email | yes | not empty | Enter your email. |
| Password | yes | not empty | Enter your password. |

Wrong email or password (server answers `401`): alert on top, **"The email or password is wrong. Try again."** Keep the email, empty the password. Never say which of the two was wrong.

### Sign up

| Field | Required | Rule | Message under the field |
|---|---|---|---|
| First name | yes | not empty | Enter your first name. |
| Last name | yes | not empty | Enter your last name. |
| Email | yes | valid email format | Enter a valid email, like name@example.com. |
| Phone | no | digits, spaces and a leading `+` | Enter a valid phone number. |
| Password | yes | at least 8 characters | Use at least 8 characters. |
| Repeat password | yes | same as password | The passwords are different. |

Helper texts: Email "Your booking confirmations are sent here." · Phone "Optional. The hut uses it only if your plans change."

Email already registered (server answers `409`): under the email field, **"An account with this email already exists. Log in instead."** with *Log in* as a link.

All rules except the `409` are checked in the browser before sending, and checked again by the server (`400` if they fail).

### Forgot password

A team decision: no story asks for it, but without it a hiker who forgets the password could not get back into the account, and the staff must never know or set passwords. Like the confirmation of MH-03, it needs the email service.

1. **Login → "Forgot password?"** opens the *Forgot password* page (screen 8): one field, Email.
2. **Send reset link.** The server always answers the same way (`202`), whether an account exists for that email or not, so nobody can find out which emails are registered. The page shows screen 9.
3. **The email** holds a link with a random token. The token works **once** and for **1 hour**; asking for a new link cancels the old one.
4. **The link** opens *Choose a new password* (screen 10): new password and repeat, with the same rules and messages as sign-up.
5. **Save new password.** The server checks the token and the password (`204`), logs out every other session of that account, and the hiker goes back to the login with the note of screen 12.
6. **Expired or used link** (`410`): screen 11, with the email already filled in to ask for a new one.

| Where | Text |
|---|---|
| Login, under the password | **Forgot password?** |
| Forgot password, title and text | Forgot password? · Enter the email of your account. We will send you a link to choose a new password. |
| Forgot password, button | Send reset link · link: ← Back to log in |
| Link sent | If an account exists for *email*, we sent it a link to choose a new password. The link works for 1 hour. · Nothing in your inbox? Look in the spam folder, or ask for a new link. |
| New password, title | New password · For *email* |
| New password, fields | New password · Repeat new password (rules and messages as in sign-up) · button: Save new password |
| Link expired or used | The link has expired or was already used. Ask for a new one. · button: Send a new link |
| Back on the login | Your password has changed. Log in with the new one. |

### Other texts

| Where | Text |
|---|---|
| Top bar, login | No account? **Sign up** |
| Top bar, sign-up | Already registered? **Log in** |
| Top bar, both | ← Back to the hut page |
| Not logged in, opens a protected page | Log in to book a table. *(or the name of the page they wanted)* |
| Hiker opens a staff page | **Staff only.** This page is for the hut team. You are logged in as a hiker. Button: Go to Book a table |
| Server or network down | Something went wrong on our side. Try again in a minute. |

## Assumptions to confirm

- The stories do not list the hiker's account fields. We use first name, last name, email (MH-3 sends the confirmation by email) and an optional phone (MH-7 mentions name and phone).
- The app name QUOTA and the demo hut "Rifugio Alpe Lunga, 2.450 m" are ours, not from the product owner.
