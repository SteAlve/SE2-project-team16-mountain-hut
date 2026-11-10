# Login and sign-up mockup (MH-45)

Mockup for the login frontend ([MH-55](https://polito-se2-26-16.youtrack.cloud/issue/MH-55)), the backend authentication ([MH-49](https://polito-se2-26-16.youtrack.cloud/issue/MH-49)) and their tests ([MH-58](https://polito-se2-26-16.youtrack.cloud/issue/MH-58), [MH-72](https://polito-se2-26-16.youtrack.cloud/issue/MH-72)).

**Figma (source of truth):** [Mountain Hut – Mockups (Team 16)](https://www.figma.com/design/VlTombwHX1DQ7yB2x4U5Yx)

| Figma page | What it holds |
|---|---|
| **Brand · QUOTA** | Name, logo, palette, typography, motifs and usage rules |
| **MH-45 Login & sign-up** | The 15 desktop screens and the 15 phone screens below |
| **Components** | Logo, trail blaze, eye icon, button, text field (with the show/hide password toggle), alert, navbars, log out dialog, brand panel, phone browser bar and top bar, and the colour variables |

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
| 8 | Log out, asked first | ![Log out confirm](08-logout-confirm.png) |
| 9 | Log out failed | ![Log out failed](09-logout-failed.png) |
| 10 | Forgot password | ![Forgot password](10-forgot-password.png) |
| 11 | Check your email | ![Check your email](11-check-your-email.png) |
| 12 | Choose a new password (from the link in the email) | ![Choose a new password](12-choose-new-password.png) |
| 13 | Reset link not valid (expired or already used) | ![Reset link not valid](13-reset-link-not-valid.png) |
| 14 | Password changed, back on the login | ![Password changed](14-password-changed.png) |
| 15 | Change the password at the first login (account made by the staff) | ![Change the password at the first login](15-change-password-first-login.png) |

Login and sign-up are split screens: the **brand panel** on the left (hut name and altitude on a contour map), the form on the right.

The navbar shows only the pages that exist in sprint 1: *The hut* and *Book a table* for hikers, *The hut* and *Slots & tables* ([slots mockup](../slots/README.md)) for employees and the warden. Pages of later stories are added to the navbar with their story.

## On a phone

The same website opened in a phone browser, not a separate app: the React pages are the same, and the CSS rearranges them. The screens are in Figma (section *On a phone* of the MH-45 page); [phone.html](phone.html) shows them in a browser with their notes.

- **Breakpoint: 992 px** (react-bootstrap `lg`). Below it the page is one column and the navbar collapses into a menu button (`Navbar expand="lg"`). Between 576 and 991 px (tablets) the form keeps a maximum width of 440 px, centred.
- **Login:** the brand panel becomes a dark header with the logo, "No account? Sign up", the hut name and the altitude; the form slides over it as a white sheet.
- **Sign up:** the header shrinks to the logo and the hut name. Fields that sit side by side on desktop (first and last name, the two passwords) are stacked.
- **Fields:** 16 px text, so iPhones do not zoom in when a field is tapped. Email uses `type="email"`, phone `type="tel"`, so the phone shows the right keyboard.
- **Menu:** shows who is logged in, the pages of that role (current page highlighted) and Log out. Tapping a link or outside the menu closes it.
- **Log out dialog:** the same as on desktop, 16 px from the screen edges; the two buttons share the width and are 48 px tall.
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
| 9 | Menu, warden | ![Warden menu](phone/09-menu-warden.png) |
| 10 | Staff only | ![Staff only on a phone](phone/10-staff-only.png) |
| 11 | Log out, asked first (from the menu) | ![Log out confirm on a phone](phone/11-logout-confirm.png) |
| 12 | Log out failed | ![Log out failed on a phone](phone/12-logout-failed.png) |
| 13 | Forgot password | ![Forgot password on a phone](phone/13-forgot-password.png) |
| 14 | Choose a new password | ![Choose a new password on a phone](phone/14-choose-new-password.png) |
| 15 | Change the password at the first login | ![Change the password at the first login on a phone](phone/15-change-password-first-login.png) |

On a phone, Check your email, Reset link not valid and Password changed are the same as on desktop (screens 11, 13, 14) in the phone layout of the login.

## Behaviour

- **One login for every role.** Hikers, employees and the warden log in on the same page with email and password. The navbar and the menu show the role as *Warden*, as the stories call it.
- **Only hikers sign up.** Employee and warden accounts are created by the team (seed data in sprint 1). A hiker created by an employee over the phone is MH-7 ([reservation for a hiker mockup](../reservation-for-a-hiker/README.md)), not this page.
- **After login:** a hiker goes to *Book a table*; an employee or the warden goes to *Slots & tables*. If the user came from a protected page or from *Review booking* on Book a table (screen 4), send them back there instead.
- **Show or hide the password:** the password field of the login has an eye button on the right (screens 1–4). The password starts hidden; a click shows it as plain text and the icon becomes the eye struck through, another click hides it again. The focus stays in the field, so on a phone the keyboard stays open. For screen readers the button reads "Show password" or "Hide password". With an error the eye sits right of the error icon.
- **The blue note on screen 4** ("Log in to book a table.") is shown only when a user who is not logged in is sent to the login: when they open a protected page, or when they press *Review booking* on Book a table (that page is public, so anyone can see the free seats first; see the [booking mockup](../booking/README.md)). It says why they landed on the login instead of the page they clicked; without it the jump looks like an error. Opening the login page directly shows no note.
- **After sign-up:** the hiker is logged in straight away and goes to *Book a table*.
- **Password reset by email** (screens 10–14). It was added with MH-07, whose clarifications say that a hiker "can recover their password via email". The login has **Forgot password?** under the password field (screens 1–4).
  1. *Forgot password?* opens a page that asks for the email, with a *Send the link* button (screen 10).
  2. The answer is always "Check your email" (screen 11), whether the email has an account or not, so nobody can find out which emails are registered. *Send it again* asks for a new link, and the previous one stops working. The email itself is in the [emails mockup](../emails/README.md).
  3. The link in the email opens *Choose a new password* (screen 12), with the same rules as the sign-up.
  4. *Save password* goes back to the login with the email already written and a blue note (screen 14).
  5. A link that has expired or was already used opens screen 13, with *Send a new link*.

  Passwords are still stored only as hashes: nobody, the hut staff included, can read them.
- **Change the password at the first login** (screen 15). An employee can create a full hiker account for someone at the hut or on the phone (MH-07, [reservation for a hiker mockup](../reservation-for-a-hiker/README.md)). Its password is generated at random and told to the hiker.
  - When that hiker logs in with it, the login goes to *Choose your password* and no other page opens until a new password is saved.
  - Then the hiker goes on as after any login (*Book a table*, or the page they came from).
  - *Log out* leaves without changing the password, and the next login asks again.
  - The hiker can also skip the generated password and use *Forgot password?* instead.
- **Log out** is in the navbar for every role. It asks first (screen 8): a dialog "Log out?" with *Cancel* and *Log out*. Cancel, Esc or a click outside the dialog closes it and nothing happens. *Log out* ends the session and goes back to the public hut page; while the request runs both buttons are disabled and the button reads "Logging out…".
- **Log out failed** (server down or any error, screen 9): the session is still open, so the user stays logged in on the same page. The dialog stays open with an alert above the buttons, and *Log out* tries again.
- **The navbar shows only the pages that role can use** (screen 7). A hiker who opens a staff page by URL sees the "Staff only" page. An employee or the warden who opens Book a table by URL sees the free seats, with a note that only hikers can book (booking mockup).
- **While the request is running** the button is disabled and reads "Logging in…" or "Creating account…".

## Fields and rules

### Login

| Field | Required | Rule | Message under the field |
|---|---|---|---|
| Email | yes | valid email format | Enter a valid email, like name@example.com. |
| Password | yes | at least 8 characters | Use at least 8 characters. |

The password field has the show/hide eye (see *Behaviour*).

The rules and messages are the same as the sign-up's: an empty field fails the same rule. They are checked in the browser before sending, so an email or password that no account can have never reaches the server. Employee and warden accounts must also have passwords of at least 8 characters, or they cannot log in.

Wrong email or password (server answers `401`): alert on top, **"The email or password is wrong. Try again."** Keep the email, empty the password. The alert never says which of the two was wrong.

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

| Field | Required | Rule | Message under the field |
|---|---|---|---|
| Email | yes | valid email format | Enter a valid email, like name@example.com. |

### Choose a new password (screens 12 and 15)

| Field | Required | Rule | Message under the field |
|---|---|---|---|
| New password | yes | at least 8 characters | Use at least 8 characters. |
| Repeat password | yes | same as new password | The passwords are different. |

Both fields have the show/hide eye. The rules are checked in the browser before sending, and checked again by the server (`400` if they fail).

### Other texts

| Where | Text |
|---|---|
| Top bar, login | No account? **Sign up** |
| Top bar, sign-up | Already registered? **Log in** |
| Top bar, both | ← Back to the hut page |
| Not logged in, opens a protected page or presses Review booking | Log in to book a table. *(or the name of the page they wanted)* |
| Employee or warden opens Book a table | Only hikers can book a table. You are logged in as a warden. *(or an employee)* |
| Hiker opens a staff page | **Staff only.** This page is for the hut team. You are logged in as a hiker. Button: Go to Book a table |
| Server or network down | Something went wrong on our side. Try again in a minute. |
| Log out dialog | **Log out?** You will need your email and password to log in again. Buttons: Cancel, Log out |
| Log out failed | You are still logged in: something went wrong on our side. Try again in a minute. |
| Login, under the password | **Forgot password?** |
| Forgot password | **Forgot your password?** Enter the email of your account. We send you a link to choose a new password. Button: Send the link · ← Back to log in |
| Link sent | **Check your email.** If there is an account for *email*, we have sent it a link to choose a new password. Look also in the spam folder. Button: Send it again · ← Back to log in |
| Choose a new password | **Choose a new password.** For *email*. Button: Save password |
| Link expired or already used | **This link no longer works.** Red alert: The link has expired or was already used. Ask for a new one. Button: Send a new link |
| Password changed | Blue note on the login: Your password has been changed. Log in with the new one. |
| First login with a generated password | **Choose your password.** Hello *first name*. Your account was made by the hut staff: choose your own password to continue. Button: Save and continue · Not now? **Log out** |

## Assumptions to confirm

- The stories do not list the hiker's account fields. We use first name, last name, email (MH-3 sends the confirmation by email) and an optional phone (MH-7 mentions name and phone).
- The app name QUOTA and the demo hut "Rifugio Alpe Lunga, 2.450 m" are ours, not from the product owner.
- How long a reset link stays valid is not said by the product owner. The backend decides it; the mockup only shows what happens when the link no longer works (screen 13).
- The forced password change at the first login applies only to accounts made by the staff (MH-07). Whether employee and warden accounts made by the team should also change their password at the first login is not decided.
