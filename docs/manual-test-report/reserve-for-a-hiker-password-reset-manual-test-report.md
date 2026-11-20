# MH-07 — Reserve for a hiker: password reset manual test report

## Scope and result

Manual verification of a selected MH-07 password-recovery subset for a regular hiker account created by staff through **Full profile**. This report covers only the necessary, fully evidenced manual checks; it does not claim full coverage of every reset-link and validation scenario.

**Selected manual subset: 13 Pass.** This is a scoped presentation report, not a complete replacement for the E2E suite or every possible manual reset case.

| Run detail | Recorded value |
| --- | --- |
| Tester | Nadim Aride |
| Date / time / time zone | 17–18 November 2026, Europe/Rome (CET). Setup completed 17 Nov 20:52; first UI run started 20:58; follow-up checks ran 18 Nov approximately 11:29–11:45. |
| Testing task | [MH-143](https://polito-se2-26-16.youtrack.cloud/issue/MH-143) |
| Story | MH-07 — Reserve for a hiker |
| Tested application branch / commit | `dev` / `b6ba7b92027b2e13b5e77f9039dd191c197d1691` (used for the 17–18 November checks). |
| Application changes on tested version | No tracked application changes were made during the run. |
| Browser / version / operating system | Google Chrome `157.0.8103.51` on Windows. |
| Desktop viewport / phone viewport | Chrome window screenshots 898 x 817 (not CSS viewport); phone emulation explicitly 390 x 844. DevTools docking changed the available desktop content area. |
| Client / API URL | Client: `http://localhost:5173` (running); API: `http://localhost:3001` (running). |
| Database name / host / port | `mountain_hut_manual_mh07_20261117` / `localhost:5433`, in existing `mh7-e2e-postgres` container; separate from its E2E database. |
| Mailpit URL / SMTP configuration | Inbox `http://localhost:8025`; SMTP `127.0.0.1:1025`, no SMTP authentication; existing `mh7-e2e-mailpit` container. |
| Evidence location | Mailpit message IDs, Network statuses, and SQL observations are recorded inline. No screenshots or HAR files are attached. |
| Start / finish time | Setup completed 17 Nov 20:52 CET; first UI run started 20:58 CET; follow-up checks completed 18 Nov. |

## References and method

- [MH-07 E2E definition, scenarios 12–14](../e2e-definitions/MH-7-reserve-for-a-hiker-e2e-scenarios.md): generated password, recovery of a staff-created account, and expired links.
- [Login mockup](../mockups/login/README.md): password reset screens 10–14, validation and phone layouts.
- [Reset email mockup](../mockups/emails/README.md#2-password-reset-mh-07): recipient, content, expiry and single use.
- [Reserve for a hiker mockup](../mockups/reservation-for-a-hiker/README.md): Full profile, generated password and recovery fallback.
- [Architecture](../architecture.md) and [API contract](../openapi.json): reset responses and account state.
- Format follows the existing [login report](login-manual-test-report.md) and [slots/tables report](slots-tables-manual-test-report.md). The older login report predates MH-07: its expectation of no **Forgot password?** link is not applicable here.

Perform the interactions in the real UI, with the real API, database and mail capture. Use DevTools Network (Preserve log), Console and responsive mode as supporting evidence. SQL and direct API setup below are fixture preparation and inspection.

Each selected row is a completed check with a recorded result. The broader cases intentionally excluded from this report are listed in the scope note below. Record actual text/status and evidence; do not copy an expected outcome as if it were observed.

## Preparation

- [x] Record the setup version and environment above; recheck commit before UI execution.
- [x] Create the dedicated database and apply all four migrations (`000` through `003`), then run the repository seed script. Existing development/test databases were preserved.
- [x] Start API with process-local `NODE_ENV=development`, `DATABASE_URL` selecting the dedicated database and `PORT=3001`. Verify employee login (`200`), staff account creation (`201`) and logout (`204`). `server/.env` remains unchanged; a plain backend restart would use its original database settings.
- [x] Configure API process-local `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, empty SMTP credentials, `APP_URL=http://localhost:5173`, and `COOKIE_SECURE=false`. Real account emails received in Mailpit confirm delivery.
- [x] Seed employee `james.taylor@quota.example` with the repository's published demo password `quota-demo-2026`; verify login and end the setup session.
- [x] Reserve suffix `20261117`, prepare A/B/C below, and verify U is absent from the dedicated database and mailbox.
- [x] Prepare A/B/C using the real staff creation API as the seeded employee. No password supplied; server generated passwords and sent the account emails. All three have `temporary=false`, `must_change_password=true`, a stored password hash and zero bookings. No reset link has been requested.
- [x] Assign A to main recovery, B to replacement links and C to expiry. Generated passwords remain in their local Mailpit messages; none is copied into this report.
- [x] Capture per-recipient mailbox baseline: one **Your QUOTA account** message each for A/B/C; zero reset messages for A/B/C and zero messages for U. Mailpit's `total` is mailbox-wide, so baseline counts use the recipient-filtered message list. Other mail is preserved.

### Ready for the client

From the repository root, start the client and keep that terminal running:

```powershell
cd client
node node_modules/vite/bin/vite.js --port 5173 --strictPort
```

Open `http://localhost:5173/login` in Chrome. The backend is already running with the isolated configuration. Do not launch a second backend or an E2E suite during this run. If the backend is stopped, restore the process-local configuration described above before restarting it; do not assume `server/.env` points to the manual database.

Client startup verification: `/login`, `/src/main.jsx` and `/src/App.jsx` returned `200`; the proxied `/api/auth/me` returned the expected `401` for an unauthenticated request. The client rendered in Chrome. `--strictPort` prevents silently switching away from port 5173.

Setup baseline: **7 users** (3 demo staff, 1 demo hiker, A/B/C), **23 tables**, **42 slots**, **0 bookings**, **0 password-reset rows**. A/B/C identity and password-hash snapshots are retained locally outside the repository at `%TEMP%\mh07-manual-20261117-baseline.json` for later comparison; do not commit that private file. These are setup observations, not completed checklist cases.

| Fixture | Recorded email / account ID | Initial state / private notes reference |
| --- | --- | --- |
| A: staff-created hiker | `mh07-manual-20261117-a@example.com` / ID 5 | ManualA MH07 November17; generated password unchanged; one account email in Mailpit. |
| B: replacement-link hiker | `mh07-manual-20261117-b@example.com` / ID 6 | ManualB MH07 November17; generated password unchanged; one account email in Mailpit. |
| C: expiry hiker | `mh07-manual-20261117-c@example.com` / ID 7 | ManualC MH07 November17; generated password unchanged; one account email in Mailpit. |
| U: no account | `mh07-manual-20261117-u@example.com` / none | Absent from full database account listing and recipient-filtered Mailpit results at setup. |

Use distinct chosen passwords of at least eight characters. Label them P1, P2, etc. in this report, and update your private record whenever a reset succeeds. A “fresh link” means requesting a new link for the named account and using the newest message; any earlier unused link for that account becomes invalid.

## Manual checklist

The selected cases are numbered consecutively PR-01 through PR-13 and use A, B, C, or U as named in each row. Log out before login or unauthenticated-recovery checks.

| Done | ID | Check | Steps to perform | Expected outcome | Status | Recorded result / evidence |
| --- | --- | --- | --- | --- | --- | --- |
| [x] | PR-01 | Staff-created account recovery entry | Without using A's generated password, open `/login` logged out. Click **Forgot password?** and wait for the new heading. Check **Back to log in**, then reopen recovery. | `/forgot-password` shows **Forgot your password?**, Email and **Send the link**. Back returns to login. Recovery does not require a login or the generated password. | Pass | 17 Nov 2026, approximately 20:59 CET: watched Chrome UI at localhost:5173. Forgot password opened the logged-out recovery form; Back to log in returned to login, then recovery reopened. Heading, Email and Send the link observed. |
| [x] | PR-02 | Required and malformed email | Submit an empty email, then `not-an-email`. Inspect Network for each. Type a valid email afterwards. | Inline **Enter a valid email, like name@example.com.**; focus goes to Email; no reset request for invalid input. Editing clears the field error. | Pass | 18 Nov repeat: submitted empty then not-an-email in Chrome. Both showed the specified inline error; editing cleared it and the email input received the caret. Network stayed at 188 requests throughout both invalid submissions, with no reset request. |
| [x] | PR-03 | Request a link | Enter B's email and press Enter or click **Send the link** once. Record response and time. | `POST /api/auth/password-reset-requests` returns `204`. **Check your email** explains that a link is sent if an account exists, mentions spam, and offers **Send it again** and **Back to log in**. | Pass | 18 Nov repeat using B: after restoring connectivity, keyboard Enter submitted exactly one request. Network increased from 191 to 192 requests and showed password-reset-requests 204 No Content. Check your email displayed the generic conditional wording, spam reminder, resend and back controls. Mailpit delivered one reset email, ID 3lO7iFbqkYz07YWXLzkXOC. |
| [x] | PR-04 | Reset email | In the logged-out requesting browser, open `/forgot-password`, enter A's email, and click **Send the link** once. Find the resulting message addressed to A in Mailpit; this is a separate request from B's PR-03 request. Inspect rendered HTML and plain text. Compare button target with fallback URL without publishing the token. | One new reset message for the single request; subject **Choose a new password for QUOTA**; correct hiker name and recipient; usable **Choose a new password** button and fallback link to the configured client. Both formats say the link works for **24 hours**, **only once**, and that ignoring the email leaves the password unchanged. No password is included in the reset email. | Pass | Observed Mailpit message 2N9bMMv2qQnIoQoTf0ULfa: correct A recipient/name/subject; rendered HTML and Text views both contain 24-hour, single-use and ignore-message wording. Button and fallback target localhost:5173/reset-password. Opened the plain-text link successfully. Supplementary Mailpit API inspection confirmed exactly one reset message for A. |
| [x] | PR-05 | Open reset form in requesting browser | Open A's PR-04 link in the original requesting browser. | **Choose a new password**, New password, Repeat password and **Save password** appear. With local storage available, **For A's email** is shown. No current-password field or automatic login. Opening the link alone does not consume it. | Pass | Email link opened Choose a new password in the requesting Chrome profile, with For A email, New password, Repeat password and Save password; no current-password field. No password entered or saved. Supplementary SQL confirmed used_at NULL, token unexpired and must_change_password still true. |
| [x] | PR-06 | New password and first-login restriction | Log in as A with P1. Open a protected hiker page such as **My bookings** and inspect its bookings request. Reload, then log out. | Login succeeds; no forced **Choose your password** screen. Protected bookings data is accessible (`GET /api/bookings` succeeds), including after reload. Do not count the public **Book a table** page alone as proof of protected access. | Pass | 18 Nov: Nadim Aride logged in as A with the reset password; DevTools showed login `200`. Protected My bookings displayed **No upcoming bookings**, without a forced first-login screen. After Ctrl+R, My bookings remained accessible; `GET /api/bookings` returned `304 Not Modified`, validating the cached bookings response. Nadim then logged out. |
| [x] | PR-07 | Unknown account does not reveal registration | In a clean logged-out session, request recovery for U. Compare its UI/status with PR-03 and inspect Mailpit for U for 30 seconds, recording the observation window. | Same generic **Check your email** response and `204`; no claim that U is unknown. No reset email observed for U and no account created. An email failure for known users is not evidence that this case passed. | Pass | 18 Nov, logged out: U returned 204 No Content in DevTools and the same conditional Check your email screen as known B. Supplementary Mailpit API monitoring for 31.613 seconds, ending 11:33:44 CET, observed zero messages for U; a later repeat was also empty. Read-only SQL confirmed zero app_user rows for U. No account-enumeration wording appeared. |
| [x] | PR-08 | Resend and request pending state | Request B's first link L1. On **Check your email**, apply Slow 3G and click **Send it again**; try clicking again while pending. Restore network and capture L2. | Request control is disabled with **Sending…** while pending; one additional request and reset email for the resend. Confirmation remains generic. L2 differs from L1. | Pass | 18 Nov: B first received link L1 in message 3lO7iFbqkYz07YWXLzkXOC. Under DevTools 3G, double-clicked Send it again: visible Sending... pending state, then normal resend restored. Network rose once from 192 to 193 requests; the added request completed 204 in approximately 2.07 seconds. Supplementary Mailpit inspection found exactly two B reset emails and two distinct links; L2 message ID 5rNMpM6wbeUUPGzKPQGGYg. No throttling restored. The resulting links were retained for audit. |
| [x] | PR-09 | Stored lifetime and expired link | Request C's link. Record the lifetime using the SQL in **Controlled expiry and data inspection**; expire only C's pending row using the controlled procedure in that section. Open the original link and submit a valid new password. | Stored lifetime is approximately 24 hours. Submission after expiry returns `422` / `RESET_LINK_NOT_VALID`; **This link no longer works** appears. Database inspection confirms the rejected reset did not mark the row used or change C's password hash/first-login flag. | Pass | 18 Nov: requested C link, measured lifetime `86400.185641` seconds, expired exactly its pending row, and submitted matching passwords. Nadim Aride observed the invalid-link UI; DevTools showed `422 Unprocessable Entity`. Read-only comparison confirmed the password hash and `must_change_password` were unchanged, with `used_at NULL` and expired=true. |
| [x] | PR-10 | Request failure and retry | With the recovery page loaded, block `**/api/auth/password-reset-requests` using DevTools request blocking. Submit B's valid email, then unblock and retry. | Failure shows **Something went wrong on our side. Try again in a minute.**; no false confirmation, email remains and retry is possible. Retry returns `204` and produces a usable email. | Pass | 18 Nov: used DevTools Offline instead of URL-specific request blocking. B request failed with net::ERR_INTERNET_DISCONNECTED; page showed the exact generic error, retained B email, remained on the form, and re-enabled submission. Restored No throttling and retried via Tab/Enter: one 204 response, confirmation screen and fresh reset email. Email contained a localhost:5173 reset link. No password was submitted. |
| [x] | PR-11 | Save failure and retry | Open a fresh unused A reset link. Block `**/api/auth/password-resets` before clicking Save with valid passwords. Unblock and retry without requesting a new link. | Generic server-error alert, no success redirect and button becomes usable again. Since blocking prevented the request reaching the server, the same link remains usable; retry succeeds. Record password fields' actual retained/cleared state. | Pass | 18 Nov: used A's fresh, unused link from Mailpit message 2mFfvHdDnqqzqwvc11H8k6 and DevTools Offline instead of URL-specific blocking. Nadim Aride submitted matching valid values. DevTools showed password-resets failed with net::ERR_INTERNET_DISCONNECTED; form stayed open with Something went wrong on our side. Try again in a minute., both password fields still masked and populated, and Save password enabled. SQL confirmed link unused/unexpired. Restored No throttling; Nadim clicked Save password again on the same form. DevTools showed password-resets 204 No Content; browser redirected to /login with Your password has been changed. Log in with the new one. and A email prefilled. SQL confirmed latest link used. No new link was requested between attempts. |
| [x] | PR-12 | Temporary-hiker boundary | As staff, open **New hiker → Quick entry** and inspect its fields/explanation. If creating one, use a distinct test name. Compare with Full profile. | Quick entry has no email/password and explains no account/login. It cannot receive a reset email; do not use an unrelated registered email as supposed proof of temporary-hiker recovery. Full profile is the account type used in the recovery cases. | Pass | 18 Nov: logged in as seeded employee James, opened Reservations > + New hiker. Quick entry showed First name, Last name, optional Phone, no email/password, and A temporary hiker cannot log in or use the website. Full profile added Email with recovery helper text and generated-password explanation, without a staff password field. Cancelled without submitting; no new temporary account or reservation created. |
| [x] | PR-13 | Data integrity | Compare before/after snapshots for the run's accounts and reservations using the SQL in **Controlled expiry and data inspection**; inspect C's state around PR-09. | Recovery does not create duplicate accounts or reservations or change identity fields/roles. Successful reset clears `must_change_password`; rejected reset preserves password hash and flag. No raw password is stored in `password_hash`. Record comparisons without publishing hashes or credentials. | Pass | 18 Nov 12:01 CET read-only comparison with setup baseline: A/B/C identity fields, roles and temporary flags unchanged; all three have scrypt hashes different from generated-password baseline and must_change_password=false. Database still has 7 users and 0 bookings, with 0 bookings for each fixture. A reset row was used at 17 Nov 21:18:07 CET, consistent with Nadim Aride's reported reset. After Nadim Aride submitted C's expired link, comparison with the pre-expiry snapshot confirmed its password hash and must_change_password flag unchanged and used_at still NULL. Together with the recorded identity/count comparison and successful-reset state, the listed data-integrity assertions are satisfied. Login usability remains covered by the reset-flow checks. |

## Controlled expiry and data inspection

These queries support PR-09 and PR-13. Run them against the recorded dedicated database. Replace only the placeholder emails with the run's fixture addresses. Keep hashes and credentials private.

Baseline account and booking state:

```sql
SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.temporary,
       u.must_change_password,
       (SELECT count(*) FROM booking b WHERE b.hiker_id = u.id) AS bookings
FROM app_user u
WHERE u.email IN ('REPLACE_A_EMAIL', 'REPLACE_B_EMAIL', 'REPLACE_C_EMAIL');
```

Pending reset and configured lifetime for C:

```sql
SELECT u.id, u.password_hash, u.must_change_password,
       r.created_at, r.expires_at, r.used_at,
       r.expires_at - r.created_at AS lifetime
FROM app_user u
JOIN password_reset r ON r.user_id = u.id
WHERE u.email = 'REPLACE_C_EMAIL' AND r.used_at IS NULL;
```

To force expiry of only C's pending row, verify that exactly one row is returned before committing:

```sql
BEGIN;
UPDATE password_reset
SET expires_at = now() - interval '1 second'
WHERE user_id = (SELECT id FROM app_user WHERE email = 'REPLACE_C_EMAIL')
  AND used_at IS NULL
RETURNING user_id, expires_at, used_at;
-- Confirm exactly one returned row belongs to C.
COMMIT;
```

After submitting the expired link, rerun the inspection query. The row must remain unused and C's password hash and first-login flag must match the pre-expiry snapshot. Do not change the computer or server clock.

## Selected-scope coverage

The revised manual-testing scope for MH-143 selects the 13 checks listed above. Removed cases are outside this report's scope; their exclusion does not establish that the underlying product requirements have changed.

- Used-link rejection is specified in E2E scenario S13. Expired-link rejection is specified in S14 and is also checked manually here.
- Basic password and missing-token input validation is covered by tests in `server/test/dto/auth.test.js`. These assertions do not establish coverage of the corresponding browser messages or focus behavior.
- `server/test/api/reserveForAHiker.test.js` covers unknown-email privacy, reset-link use/reuse, and successful reset.
- This report makes no coverage claim for old-password rejection, replaced-link rejection, unknown-token handling, or the complete reset-form validation flow.
- Password visibility, reset pending-state behavior, Incognito completion, keyboard traversal, and responsive layouts are outside the selected checklist.

## Completed-run summary

| Result | Count |
| --- | --- |
| Pass | 13 |
| Partial | 0 |

Overall assessment: **Selected manual subset complete; full password-reset verification remains outside this report's scope.**

Evidence is recorded inline through Mailpit message IDs, Network statuses, and SQL observations. No screenshots or HAR files are attached. No final-environment cleanup claim is made because the omitted final audit was outside the selected scope.
