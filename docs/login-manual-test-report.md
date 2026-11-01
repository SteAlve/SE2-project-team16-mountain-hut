# Login, sign-up and logout: manual test report

The goal of the test is to check by hand that login, sign-up and logout behave as [the mockup](mockups/login/README.md) says ([MH-55](https://polito-se2-26-16.youtrack.cloud/issue/MH-55), [MH-49](https://polito-se2-26-16.youtrack.cloud/issue/MH-49)): fields and messages, redirects, the navbar of each role, the session cookie and the phone layout.

86 scenarios were run, and all 86 behaved as expected (✅ in the **Result** column).

| | |
|---|---|
| Tester | Ferrone Luca |
| Date | 31/10/2026 |
| Commit | 716ac89 |
| Browser | Google Chrome |
| Phone (DevTools device) | iPhone 16 Pro Max (440x956) |

## How it was tested

- **From a clean database:** in `server`, `npm run db:reset`, then `npm run db:seed`. The server ran with `npm start` and the client with `npm run dev` in `client`, at http://localhost:5173.
- **Accounts:**
  - Warden `emily.parker@quota.example`, employees `james.taylor@quota.example` and `oliver.wilson@quota.example`, all with the password `quota-demo-2026`.
  - Hiker: created in scenario S-01 (`giulia.rossi@example.com`, password `hiker-pass-1`).
- **Tools:** the Chrome DevTools. *Network* to see the requests and to slow them down (throttling *Slow 3G*), *Application → Cookies* to see the session cookie `sid`, the device toolbar for the phone.
- **On the phone:** the browser scenarios were run with the device toolbar set to the iPhone 16 Pro Max, and the layout of every page was checked there (see *Phone layout*).
- **Server down:** the server was stopped with Ctrl+C while the client kept running, and started again after the scenario.
- **Each section started logged out**, unless the scenario says otherwise.

## Login

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| L-01 | The page | Open `/login` directly | Title *Log in*, fields Email and Password, button *Log in*, top bar "No account? **Sign up**" and "← Back to the hut page", link "Create a hiker account". No blue note, no "Forgot password?" | ✅ |
| L-02 | Both fields empty | Click *Log in* with nothing typed | Under Email "Enter a valid email, like name@example.com.", under Password "Use at least 8 characters.". Focus on Email. No request in *Network* | ✅ |
| L-03 | Malformed email | Email `giulia@example`, and password of 8 characters (`ciaociao`) | Email error only. No request sent | ✅ |
| L-04 | Short password | Valid email (`james.taylor@quota.example`), password `1234567` (7 characters) | Password error only. No request sent | ✅ |
| L-05 | The error goes away while typing | After L-02, type a letter in Email | The Email error disappears at once; the Password error stays | ✅ |
| L-06 | Wrong password | `emily.parker@quota.example`, password `wrong-password` | Alert on top "The email or password is wrong. Try again.". Email kept, password emptied, focus on Password. Response `401` | ✅ |
| L-07 | Unknown email | `nobody@quota.example`, password `quota-demo-2026` | The same alert as L-06, word for word (it never says which of the two was wrong) | ✅ |
| L-08 | Warden | Log in as the warden | Goes to `/slots` (*Slots & tables*). Navbar: *The hut*, *Slots & tables*, "Emily Parker", *Warden*, filled avatar "EP", *Log out* | ✅ |
| L-09 | Employee | Log in as `james.taylor@quota.example` | Goes to `/slots`. Navbar like L-08 but role *Employee* and avatar filled | ✅ |
| L-10 | Hiker | Log in as the hiker of S-01 | Goes to `/book` (*Book a table*). Navbar: *The hut*, *Book a table*, name and role *Hiker* | ✅ |
| L-11 | Email with capitals and spaces | Email `  Emily.Parker@QUOTA.example  ` (spaces around), correct password | Logged in as the warden | ✅ |
| L-12 | Password is case sensitive | Warden email, password `QUOTA-DEMO-2026` | The alert of L-06 | ✅ |
| L-13 | While logging in | Throttling *Slow 3G*, log in | The button reads "Logging in…" with a spinner and is disabled; a second click sends no second request | ✅ |
| L-14 | Server down | Stop the server, log in with correct credentials | Alert "Something went wrong on our side. Try again in a minute.". Nothing else changes | ✅ |
| L-15 | Enter submits | Fill both fields and press Enter in Password | Same as clicking *Log in* | ✅ |
| L-16 | Links | Click *Sign up*, then come back and click "Create a hiker account", then "← Back to the hut page" | The first two open `/signup`, the last opens `/` | ✅ |

## Show or hide the password

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| P-01 | Hidden at start | Type a password on `/login` | Dots, eye icon on the right | ✅ |
| P-02 | Show | Click the eye | The password is plain text, the icon becomes the eye struck through. The cursor stays in the field | ✅ |
| P-03 | Hide again | Click it again | Dots again, plain eye | ✅ |
| P-04 | Screen reader label | Inspect the button (DevTools → Accessibility) before and after the click | `aria-label` "Show password", then "Hide password" | ✅ |
| P-05 | With an error | Trigger L-04 | The eye sits right of the red error icon, they do not overlap | ✅ |
| P-06 | Only on the login | Open `/signup` | The two password fields of the sign-up have no eye | ✅ |

## Sign up

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| S-01 | A new hiker | First name `Giulia`, last name `Rossi`, email `giulia.rossi@example.com`, phone `+39 333 123 4567`, password and repeat `hiker-pass-1`, *Create account* | Response `201`. Logged in at once, goes to `/book`, navbar "Giulia Rossi", *Hiker* | ✅ |
| S-02 | The page | Log out, open `/signup` | Title *Create your account*, "Fields marked * are required.", `*` on every field but Phone, the helper texts under Email and Phone, top bar "Already registered? **Log in**" | ✅ |
| S-03 | All fields empty | Click *Create account* | Errors under First name, Last name, Email, Password ("Enter your first name.", "Enter your last name.", "Enter a valid email, like name@example.com.", "Use at least 8 characters."); no error on Phone and Repeat password. Focus on First name. No request sent | ✅ |
| S-04 | Only spaces in the names | First and last name `   `, the rest valid | "Enter your first name." and "Enter your last name." | ✅ |
| S-05 | Malformed email | Email `giulia.rossi@`, the rest valid | Email error only, the page scrolls to it | ✅ |
| S-06 | Wrong phone | Phone `333-123-4567`, then `abc`, then `39+333` | "Enter a valid phone number." each time | ✅ |
| S-07 | Phone left empty | A new email, no phone | Account created (phone is optional) | ✅ |
| S-08 | Passwords different | Password `hiker-pass-1`, repeat `hiker-pass-2` | Under Repeat password "The passwords are different." | ✅ |
| S-09 | Short password | Password and repeat `1234567` | "Use at least 8 characters." under Password only | ✅|
| S-10 | Email already registered | Sign up again with `giulia.rossi@example.com` | Response `409`. Under Email "An account with this email already exists. **Log in** instead.", focus on Email. The *Log in* link opens `/login` | ✅ |
| S-11 | The same email with capitals | Sign up with `Giulia.Rossi@EXAMPLE.com` | The error of S-10 | ✅ |
| S-12 | A staff email | Sign up with `emily.parker@quota.example` | The error of S-10 (the staff account is not overwritten: the warden still logs in with `quota-demo-2026`) | ✅ |
| S-13 | Spaces around the fields | First name `  Marco  `, email `  marco@example.com  `, the rest valid | Created; the navbar shows "Marco" without spaces | ✅ |
| S-14 | While creating | Throttling *Slow 3G*, create an account | "Creating account…" with a spinner, button disabled | ✅ |
| S-15 | Server down | Stop the server, create a valid account | Alert "Something went wrong on our side. Try again in a minute." | ✅ |
| S-16 | The new account can log in | Log out, log in with the account of S-07 | Logged in as a hiker, goes to `/book` | ✅ |

## Protected pages and roles

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| R-01 | Not logged in, Book a table | Open `/book` | Sent to `/login` with the blue note "Log in to book a table." | ✅ |
| R-02 | Back to the page after login | From R-01, log in as the hiker | Back on `/book` | ✅ |
| R-03 | Not logged in, Slots & tables | Open `/slots` | `/login` with "Log in to see the slots and tables." | ✅ |
| R-04 | Back to the staff page | From R-03, log in as an employee | Back on `/slots` | ✅ |
| R-05 | The note gives way to the error | From R-01, log in with a wrong password | Only the red alert is shown, the blue note is gone | ✅ |
| R-06 | Hiker on a staff page | Logged in as a hiker, type `/slots` in the address bar | The *Staff only* page at `/slots`: "This page is for the hut team. You are logged in as a hiker." and the button *Go to Book a table*, which opens `/book` | ✅ |
| R-07 | Hiker sent to a staff page by the login | Logged out, open `/slots`, log in as the hiker | The *Staff only* page | ✅ |
| R-08 | Staff on the hiker page | Logged in as the warden, open `/book` | Sent to `/slots` | ✅ |
| R-09 | Unknown address | Open `/does-not-exist` | Sent to `/` | ✅ |
| R-10 | Reload keeps the login | Logged in, reload the page (F5) on `/book` or `/slots` | Still logged in on the same page; no flash of the logged-out navbar or of the login page | ✅ |
| R-11 | A new tab keeps the login | Logged in, open the app in a new tab | Logged in there too | ✅ |
| R-12 | The active page | Click each link in the navbar | The current page is highlighted | ✅ |
| R-13 | Logged-out navbar | Logged out, open `/` | Navbar: logo, *The hut*, *Log in* | ✅ |

> **Changed after this test (PR #30, Book a table).** `/book` is now public, so R-01 and R-08 no longer describe the app; they have to be run again on the new commit:
> - **R-01:** logged out, open `/book`: the page opens and shows the free seats. Choose a day, people and a time and press *Review booking*: sent to `/login` with the blue note "Log in to book a table." R-02 and R-05 start from there and do not change.
> - **R-08:** logged in as the warden, open `/book`: the page stays open, with the blue note "Only hikers can book a table. You are logged in as a warden." and *Review booking* disabled ("Only hikers can book.").

## Logout

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| O-01 | It asks first | Logged in, click *Log out* | Dialog "Log out?", "You will need your email and password to log in again.", *Cancel* and *Log out*. The page behind is dimmed and cannot be clicked | ✅ |
| O-02 | Cancel | Click *Cancel* | The dialog closes, still logged in, no request in *Network* | ✅ |
| O-03 | Esc | Open the dialog, press Esc | As O-02 | ✅ |
| O-04 | Click outside | Open the dialog, click on the dimmed area | As O-02 | ✅ |
| O-05 | Log out | Open the dialog from `/book`, click *Log out* | Response `204`. Back on `/` with the logged-out navbar. The login page is never shown in between | ✅ |
| O-06 | From a staff page | As the warden on `/slots`, log out | As O-05 | ✅|
| O-07 | While logging out | Throttling *Slow 3G*, click *Log out* in the dialog | "Logging out…", both buttons disabled; Esc and a click outside do nothing | ✅ |
| O-08 | Logout failed | Open the dialog, stop the server, click *Log out* | The dialog stays open with the alert "You are still logged in: something went wrong on our side. Try again in a minute."; the user is still logged in on the same page | ✅ |
| O-09 | Try again | After O-08, start the server, click *Log out* again | Logged out, as O-05 | ✅ |
| O-10 | Cancel after a failure | After O-08, click *Cancel* | The dialog closes, still logged in. Opening it again shows no alert | ✅ |
| O-11 | The session is really over | Log out, then open `/book` | Sent to `/login` with the blue note | ✅ |
| O-12 | Back button | Log out from `/book`, press the browser back button | No page of the logged-in user is shown: `/login` with the note | ✅|
| O-13 | Reload after logout | Log out, reload | Still logged out | ✅ |
| O-14 | Two tabs | Logged in on two tabs, log out on the first, reload the second | The second is logged out too | ✅ |
| O-15 | Log in again | After O-05, log in with the same account | Works, as L-08 to L-10 | ✅ |

## Session and cookie

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| C-01 | The cookie | Log in, look at *Application → Cookies* | One cookie `sid`, *HttpOnly* ✓, *SameSite* Lax, path `/`, expiry about 24 hours from now | ✅ |
| C-02 | Not readable from JavaScript | In the *Console*, type `document.cookie` | `sid` is not in the answer | ✅ |
| C-03 | Gone after logout | Log out, look at the cookies again | `sid` is gone | ✅ |
| C-04 | No password in the answers | Look at the responses of `/api/auth/login`, `/register` and `/me` in *Network* | Only `id`, `firstName`, `lastName`, `email`, `phone`, `role`; no password or hash | ✅ |
| C-05 | A stolen cookie stops working | Log in, copy the value of `sid`, log out, then `curl -i --cookie "sid=<value>" http://localhost:3001/api/auth/me` | `401` | ✅ |
| C-06 | Session expiry | Start the server with `SESSION_TTL_HOURS=0.01` (36 seconds), log in, wait one minute, reload | Logged out. Start the server again without the variable after the test | ✅ |
| C-07 | Login replaces a planted cookie | Logged out, in *Application → Cookies* add `sid` = `fake`, then log in | The value of `sid` changes to a new long random string | ✅ |

## The server checks again

The browser checks stop a normal user, so these went straight to the server with `curl` (in a terminal, with the server running).

| # | Scenario | Command | Expected | Result |
|---|---|---|---|---|
| A-01 | Sign up as a warden | `curl -i -X POST localhost:3001/api/auth/register -H 'Content-Type: application/json' -d '{"firstName":"Eve","lastName":"X","email":"eve@example.com","password":"12345678","role":"WARDEN"}'` | `400`, "Unknown field: role"; no account created | ✅ |
| A-02 | Short password | The same without `role`, with `"password":"1234567"` | `400` | ✅ |
| A-03 | Malformed email | `"email":"eve@"` | `400` | ✅ |
| A-04 | Wrong phone | `"phone":"abc"` | `400` | ✅|
| A-05 | Invalid JSON | `curl -i -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{bad'` | `400`, "Request body must be valid JSON" | ✅ |
| A-06 | Empty login | `curl -i -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{}'` | `400` | ✅ |
| A-07 | Who am I, logged out | `curl -i localhost:3001/api/auth/me` | `401` | ✅ |
| A-08 | Logout, logged out | `curl -i -X POST localhost:3001/api/auth/logout` | `204` (not an error) | ✅ |


## Keyboard and accessibility

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| K-01 | Tab order of the login | Press Tab from the top of `/login` | Top links, Email, Password, eye, *Log in*, "Create a hiker account"; the focus is always visible | ✅ |
| K-02 | Errors read out | Trigger L-02, inspect Email | `aria-invalid="true"` and `aria-describedby` pointing to the message | ✅ |
| K-03 | Focus stays in the dialog | Open the logout dialog, press Tab several times | The focus moves only between *Cancel* and *Log out* | ✅ |
| K-04 | Labels | Click on the label "Email" | The cursor goes into the field | ✅ |

## Phone layout

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| M-01 | Every page on the phone | DevTools device iPhone 16 Pro Max (440x956): open `/`, `/login`, `/signup`, `/book`, `/slots`, the *Staff only* page and the logout dialog | The layout adapts to the width, with no horizontal scroll and nothing cut off or overlapping | ✅ |

## Findings

- **No defect found.** Every scenario behaved as the mockup says, in the browser, on the phone and on the server.
- **The server repeats the browser checks.** Invalid sign-ups and logins sent with `curl` were refused with `400`, and a `role` in the sign-up is rejected, so no one can make themselves staff (A-01 to A-06).
- **The session is handled safely.** The cookie `sid` is *HttpOnly* and *SameSite* Lax, it is gone after logout, an old value no longer works, and a planted value is replaced at login (C-01 to C-07).

## Result

All 86 scenarios behaved as expected on commit `716ac89`: login, sign-up and logout work as [the mockup](mockups/login/README.md) says ([MH-55](https://polito-se2-26-16.youtrack.cloud/issue/MH-55), [MH-49](https://polito-se2-26-16.youtrack.cloud/issue/MH-49)), on the phone too.

