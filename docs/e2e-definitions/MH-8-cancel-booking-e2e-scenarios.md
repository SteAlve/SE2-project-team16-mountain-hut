# MH-8 - Cancel a booking

These Given/When/Then scenarios define MH-08 browser E2E coverage and explicitly
identified API/server-level checks. The approved scenarios are implemented by the
22 tests in [mh-8-cancel-booking.spec.js](../../e2e/tests/mh-8-cancel-booking.spec.js).
The original frontend/backend baseline was `origin/qa` at `d03e63b`; the current
QA comparison is `de196ba`, which includes PR #119's unit/integration tests.

The story lets a hiker cancel a table booking so the hut can make the places
available to other guests. The PO clarification is explicit: **There are no time
constraints, hikers can cancel a reservation at any time.** Changing a booking
belongs to MH-06; its editor and dietary popup are not part of this flow.

## Frontend contract for E2E testability

1. **My bookings** is `/bookings`, protected for hikers. The list is named
   **Your bookings**; each **listitem** is named `Booking QUOTA-xxxxx`.
   Scope actions with `getByRole('listitem', { name: 'Booking QUOTA-xxxxx', exact: true })`.
2. The card's visible **Cancel booking** button has accessible name
   `Cancel booking QUOTA-xxxxx`. It is enabled independently of **Edit** and its
   **Changes closed on…** deadline. Select it directly; do not open the edit dialog.
3. The confirmation is a native **dialog** named **Cancel this booking?**:
   `getByRole('dialog', { name: 'Cancel this booking?', exact: true })`.
   Its description is `Your table for N on Sat 17 Jul, 13:00 – 14:00 will be cancelled.`,
   using the chosen booking's party size, day and time. The reference is on the
   originating card, not in the current dialog's title or description.
4. Inside that dialog, locate the exact **Keep booking** and **Cancel booking**
   buttons. Opening it sends no DELETE. Keep booking, Escape, or a real click
   outside its bounding rectangle dismisses it when not pending. For the backdrop,
   use a viewport point outside the dialog; do not force-click an underlying card.
5. While pending, the confirm button is named **Cancelling…**, both buttons are
   disabled, and Escape/backdrop dismissal is blocked. Scope assertions to the
   dialog; the card and dialog buttons have different accessible names.
6. Success closes the dialog, removes the selected booking immediately, shows a
   **status** notice `Booking QUOTA-xxxxx cancelled. We emailed you a confirmation.`,
   and refreshes `GET /api/bookings`. No full-page reload is required.
7. A stale `422` closes the dialog, clears any success notice, refreshes the list,
   and shows an **alert** `This booking was already cancelled.`. A `404` follows
   the same flow with `This booking is no longer in your list.`.
8. A DELETE `401` navigates to login with the bookings return context. Other
   failures keep the dialog open for retry: `403` displays the server message;
   a network error or `500` displays
   `Something went wrong on our side. Try again in a minute.` as an alert.
9. Tests use roles, accessible names, response synchronization and visible states,
   not CSS classes, positional selectors, forced clicks or fixed sleeps. When the
   last booking leaves, the heading is **No upcoming bookings.** and the action is
   **Book a table**.

## Shared business constraints

1. Only an authenticated HIKER can cancel their own booking. Another owner's
   booking is hidden behind the same `404` as a missing booking.
2. `DELETE /api/bookings/:bookingId` has no cancellation request body. Successful
   `204 No Content` has an empty response body. Browser response checks assert
   status only: Chromium may not expose a 204 body through `response.text()` or
   `response.json()`. Scenario 6's APIRequestContext check independently verifies
   empty response text.
   No seating preview, PATCH, or alternative cancellation endpoint is involved.
3. No editing, booking-closing, or cancellation deadline applies to this DELETE.
   The server clock determines `cancelled_at`; a browser clock does not control it.
4. Cancellation preserves the `booking` row, its ID, owner, slot, party size and
   creation time, plus historical `booking_table` and `booking_requirement` rows.
   Only `cancelled_at` becomes non-null. Availability counts only active bookings.
5. Release exactly this booking's reserved seats, including partial table occupancy.
   Do not release another booking's seats. The original hiker can book the slot
   again because cancelled bookings do not count for active-booking uniqueness.
6. The list contains the owner's non-cancelled bookings with meal **date from today
   on**, in the hut timezone. Previous dates are absent; today's meals can still
   appear after their start. Use a previous-date fixture for past-booking API checks.
7. One successful cancellation generates one cancellation email for a regular
   hiker with email. Discarded/rejected attempts generate none. Notification failure
   is logged without reverting cancellation; the UI notice alone proves no delivery.

Errors use the actual JSON shape `{ "error": "ErrorClass", "message": "..." }`;
these cancellation errors do not introduce a machine-readable `code` field.

| DELETE result | Error and exact message |
|---|---|
| `400` | `ValidationError`: `bookingId must be a positive integer` |
| `401` | `UnauthorizedError`: `Authentication required` |
| `403` | `ForbiddenError`: `Only hikers can cancel bookings` |
| `404` | `NotFoundError`: `Booking <id> not found` |
| `422` | `UnprocessableError`: `This booking was already cancelled` |
| `500` | `InternalServerError`: `Unexpected error` |

Use valid IDs for authentication/role tests and an authenticated hiker for ID
validation; middleware or DTO validation must not mask the rule being tested.

## Test data and environment

1. Use the dedicated PostgreSQL database in `E2E_DATABASE_URL`; the existing
   `e2e/start-server.js` passes it as the backend's `DATABASE_URL`. Never fall back
   to shared development data. Apply the existing migrations before execution.
2. Create isolated hikers, slots, table sets and bookings with unique identifiers.
   Authenticate through the real registration/login API or UI using browser-context
   cookies; keep other hikers/visitors in separate sessions. Staff fixtures cover
   EMPLOYEE and WARDEN. Use accounts without an outstanding password-change gate.
3. Use dynamically generated meal dates in **Europe/Rome**, comfortably outside
   deadlines except Scenario 6's deliberately near meal. Fixtures may use the real
   DAO for otherwise unavailable historical/near-deadline setup. No demo records,
   browser-only server-clock claims, or exact-boundary timing assumptions.
4. Before each action, record booking IDs/references, details, cancellation state,
   assigned seats, requirements, slot availability and relevant email IDs. Observe
   DELETE and subsequent list responses before triggering the action. Compare
   saved state via authenticated GET and SQL; absence from GET cannot prove row retention.
5. Use real Mailpit, as MH-03 does: SMTP host/port from the environment (CI uses
   `localhost:1025`), API through `MAILPIT_URL` (CI `http://localhost:8025`). Search
   `/api/v1/search` by recipient, then read `/api/v1/message/:id`. Correlate exact
   cancellation subject and reference, excluding the original confirmation and
   previously recorded messages. Missing Mailpit is a reported blocker, not a pass.
6. Wait for completed requests, refreshed lists and email indexing with bounded
   assertions/polling. For negative emails, compare the recorded IDs after the
   action/request lifecycle and persistence read; do not use `page.waitForTimeout()`.
7. Cleanup runs even after failed assertions and removes only this scenario's
   records: bookings (children cascade), slots, hut tables, table sets, then users
   and their dependent sessions. Delete only captured Mailpit IDs belonging to the
   fixture; never clear the entire mailbox or other stories' database records.

## Scenario 1: Cancellation is available on the correct booking

**Given**

1. Hiker A has active future bookings before and after the editing deadline, plus
   cancelled and previous-date historical bookings; hiker B has a separate booking.

**When**

1. A opens My bookings using their authenticated browser session.

**Then**

1. Only A's active bookings from today on are listed, with their own references.
2. Each card has its own enabled `Cancel booking QUOTA-xxxxx` button.
3. On the near meal, Edit is disabled and Changes closed on… is visible, while
   Cancel booking remains enabled. Neither the change dialog nor a DELETE opens/runs.

## Scenario 2: Opening confirmation does not cancel

**Given**

1. An authenticated hiker has a recorded active booking and the cancellation
   request observer is registered.

**When**

1. The hiker selects the cancellation button for that exact booking reference.

**Then**

1. Cancel this booking? opens with the correct party size, formatted day and time,
   and the actual description ending **will be cancelled.**
2. Keep booking and Cancel booking are enabled inside that dialog.
3. No DELETE or cancellation email occurs. The row, requirements, assignments and
   occupied seats remain unchanged; the MH-06 editor does not open.

## Scenario 3: Abandoning confirmation leaves the booking intact

Run independent variants: **Keep booking**, **Escape**, and a normal **backdrop click**.
The backdrop variant is supported by the current dialog's outside-click handler.

**Given**

1. The confirmation is open for an active booking, with recorded state and email baseline.

**When**

1. The hiker performs the chosen dismissal, without selecting Cancel booking.
2. The hiker reloads My bookings and re-reads persisted state.

**Then**

1. The dialog closes; no DELETE was sent and the booking remains visible.
2. The booking, null `cancelled_at`, historical children and availability are
   unchanged after reload. No new cancellation email is captured.

## Scenario 4: Confirming cancellation succeeds and persists

**Given**

1. The hiker has two recorded active bookings; the target includes dietary needs
   and table assignments. Its confirmation is open and mail capture is healthy.

**When**

1. The hiker selects the dialog's Cancel booking button and waits for DELETE and
   the automatic booking-list refresh, then reloads the page.

**Then**

1. Exactly one DELETE targets the recorded ID, with no body, and returns `204`
   with no content. Assert the browser response status without reading its body;
   the separate Scenario 6 API check verifies empty response text safely.
2. The dialog closes, only the target card disappears, and the exact status is
   `Booking QUOTA-xxxxx cancelled. We emailed you a confirmation.`
3. The refreshed and reloaded authenticated lists exclude the target. The other
   booking remains visible with unchanged persisted details and assignments.
4. SQL retains the target and all its child rows, with non-null `cancelled_at`
   within the server-side operation interval. The other fields match the snapshot.
5. Exactly one cancellation email is captured, with Scenario 7's content.

## Scenario 5: Released seats can be booked again without losing history

**Given**

1. A slot has one table of capacity `8`: A reserves `3` seats and B reserves `2`,
   leaving `3` free. Record both rows, assignments, requirements and availability.
2. The meal is comfortably beyond the new-booking cutoff so released seats can be reused.

**When**

1. A cancels through the real browser confirmation and receives `204`.
2. Re-read public slot availability and actual table occupancy. In independent
   variants, B books as another new hiker C, or A rebooks, using a fresh seating
   preview and the normal booking API. B's existing booking is not reused as C.

**Then**

1. Free seats increase from `3` to `6`, exactly A's `3` released seats; B still
   occupies `2` seats and B's saved details/children are unchanged.
2. The new reservation can use all `6` free seats and leaves `0` free. It has a new
   booking ID; A's cancelled row and original assignments/requirements still exist.
3. In A's rebooking variant, only the replacement is active for A and this slot.
   Do not count its new-booking confirmation as another cancellation email.

## Scenario 6: Cancellation works after editing closes, with no backend deadline

**Given**

1. A hiker has an active meal comfortably less than 48 hours away, for example
   tomorrow at the hut, with known occupied seats and healthy mail capture.

**When**

1. The hiker opens My bookings and cancels that booking directly from its card.

**Then**

1. Edit is disabled with its deadline shown; Cancel booking is enabled and opens
   its own confirmation. DELETE returns empty `204`, the card leaves the list,
   seats are released and one cancellation email is delivered.

### Separate API/server-level no-deadline check

**Given** a recorded active booking on a previous hut date and a valid owner session.

**When** the owner directly sends DELETE, without attempting to find a past card.

**Then** the API accepts it with `204`, retains history and sets `cancelled_at`;
active reservation/seat calculations exclude it. Reuse PR #119's injected-clock
cases for before, at and after the editing deadline and after the meal. A browser
clock cannot establish these server-time guarantees, and past slots need not be
returned by the public future-availability endpoint.

## Scenario 7: The cancellation email contains the agreed original details

**Given**

1. A regular hiker has a booking with known name, meal, party size and dietary
   needs; the initial confirmation's message IDs are recorded separately.

**When**

1. The hiker successfully cancels using the browser and the real backend, then
   the test reads the new correlated message through Mailpit.

**Then**

1. Exactly one new message targets that hiker, with subject
   `Your booking has been cancelled (QUOTA-xxxxx)`.
2. Plain text and HTML show the same reference, full name, original date/time,
   party size and **Cancelled on** value. For example, date `17 July 2027`, time
   `13:00–14:00`, and cancellation `14 July 2027, 11:32` are formats, not fixed fixtures.
3. Cancellation time matches SQL `cancelled_at` formatted to minutes in the hut's
   Europe/Rome timezone, not the browser's timezone or an assumed exact click time.
4. Both versions say **The seats are free again for other guests.** and close
   **We hope to see you at the hut another time.** There are no dietary details or
   assigned table numbers, although those rows remain stored.

SMTP refusal must still allow `204` and retain cancellation: PR #119 verifies this
with a real rejecting SMTP inbox. Do not replace this backend proof with a mocked
204 in a browser. A separate SMTP-failure E2E variant requires isolated, controllable
mail infrastructure and must not interrupt other suites' shared Mailpit instance.

## Scenario 8: Already-cancelled state closes the stale confirmation

**Given**

1. A has confirmation open. A second tab/session of the same hiker cancels that
   booking through the real API; record its committed state and cancellation email.

**When**

1. A confirms the still-open stale dialog and the test observes its DELETE and refresh.

**Then**

1. The genuine second DELETE returns `422` and the exact UnprocessableError above.
2. The dialog closes, the list refreshes, the target is absent, and the alert is
   `This booking was already cancelled.` There is no new success status.
3. The first `cancelled_at`, children and availability are unchanged, and no second
   cancellation email is generated. Compare against the first cancellation's baseline.

For a genuine missing booking, a separate valid-ID `404` variant closes and refreshes
with **This booking is no longer in your list.** A retained cancelled row yields
`422`, not `404`. Controlled responses may separately test these UI branches but
must be labelled UI contract tests. Simultaneous DELETE atomicity belongs to the
deterministically coordinated integration case in PR #119, not unsynchronized clicks.

## Scenario 9: Another hiker's cancellation is hidden and forbidden by ownership

**Given**

1. A and B have separate authenticated sessions and recorded active bookings,
   including B's requirements, seat assignments and email baseline.

**When**

1. A opens My bookings and sends a separate authenticated API DELETE targeting B's ID.
2. Re-read both bookings through their owners' sessions and inspect SQL/availability.

**Then**

1. A sees only A's cards and has no cancellation action for B. Do not invent a direct
   cancellation page or use DOM injection to access B's UI.
2. The API returns `404` with `Booking <B-id> not found`, without exposing B's details.
3. Neither booking nor its children/seats change. B still sees their booking and
   receives no cancellation email; A receives no successful-cancellation notice.

## Scenario 10: Authentication, staff, missing bookings and invalid IDs

Run independent cases using the error table and a recorded unaffected active booking.

**Given**

1. The selected caller is a visitor, EMPLOYEE, WARDEN, or an authenticated hiker.
   The latter uses a verified missing positive ID or an invalid ID.

**When**

1. A visitor opens `/bookings`; staff separately attempts that route. Each case
   also sends its own direct DELETE with the selected session and identifier.
2. For invalid IDs, use representative `0`, `-1`, nonnumeric `abc`, fractional
   `1.5`, and malformed `12x` strings. Expanded parser edge cases remain server tests.

**Then**

1. A visitor goes to login with **Log in to see your bookings.**; DELETE returns
   `401`. Staff is redirected to its role's start page, has no hiker cancellation
   dialog, and valid-ID DELETE returns `403` for both staff roles.
2. The authenticated missing-ID attempt returns `404`; invalid-ID attempts return
   `400`, with the exact error/message shape documented above.
3. No attempt changes the recorded booking, children, seats or email baseline.

Additional session-expiry variant: after opening a hiker's confirmation, invalidate
only that fixture's session and confirm. A real `401` sends the browser to login
with the bookings return context, with no cancellation or false success notice.

## Scenario 11: Pending requests prevent duplicate actions and failures allow retry

### Pending UI with a real DELETE held before forwarding

**Given** an open confirmation and a test gate holding DELETE before it reaches
the real backend; observers are registered before confirmation.

**When** the hiker rapidly double-clicks the enabled confirm button, then presses
Escape twice and clicks the backdrop while the request remains gated. Check that
the dialog remains visible after each Escape and after the backdrop click.

**Then** exactly one DELETE is observed, Cancelling… and Keep booking are disabled,
the dialog remains visible, and no success notice is shown. Do not force-click a
disabled button or let a locator wait until it becomes enabled and call that a duplicate.
Release the gate to the real server and verify `204` and Scenario 4's final state.
If holding the response after forwarding instead, do not claim the DB is still active.

### Network/server-error UI contract and retry

**Given** an open confirmation and an isolated route failure before forwarding:
either abort transport or fulfill the documented `500` JSON response.

**When** the hiker confirms once, then retries after the controlled failure is removed.

**Then** the first failure shows **Something went wrong on our side. Try again in
a minute.**, no success status, and an open dialog with enabled Keep booking and
Cancel booking. The real retry sends one further DELETE and can succeed with `204`.
Verify unchanged persistence after the unforwarded failure and cancellation after retry.

Label controlled abort/500 cases **UI contract**, not real database rollback tests.
An actual backend failure requires a supported isolated fault fixture. A lost
response after server commit may already have cancelled the booking: do not assert
rollback from a network error alone; a retry can legitimately take Scenario 8's `422` path.

## Scenario 12: List refresh preserves the correct cancellation and empty state

Run independent variants with several active bookings and with only one remaining.

**Given**

1. The hiker's recorded list contains the target and the selected variant's other
   active bookings. Card actions are scoped by reference, never by list position.

**When**

1. The hiker cancels the target, waits for the successful list refresh, then
   reloads/reopens My bookings and inspects the new authenticated GET response.

**Then**

1. Only the target disappears; surviving references, data and assignments remain
   unchanged. Neither refresh nor reload restores the cancelled booking.
2. With no active bookings left, **No upcoming bookings.** and **Book a table**
   appear, the target is absent from GET, and its historical SQL row still exists.

An optional out-of-order-response UI contract variant may hold a genuine older
GET response until the newer cancellation refresh has applied. It must establish
a real list-loading trigger; a standalone `page.request.get()` does not update
React state. The normal page has no always-visible refresh button. If no stable
trigger is available, report that race variant as unimplemented rather than invent
one or use a sleep; the real refresh/reload cases above remain mandatory.

## Existing coverage and execution boundaries

PR [#119](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/119) is
merged into `qa` at `de196ba`. Its unit/integration files are available on
`origin/qa`; the E2E branch originally predates that merge and needs a manual QA
update. The comparison adds only those tests and their unit-discovery configuration,
with no production or E2E infrastructure changes.

- `server/test/api/cancelBooking.test.js`: real HTTP/SQL seat release, rebooking,
  unchanged history/other bookings, auth/ID errors, repeat cancellation, SMTP
  refusal, no editing cutoff/past meals, and lock-coordinated concurrent DELETEs
  with one `204`, one `422`, and one notification. Reuse that backend coverage.
- Its temporary-hiker service integration verifies cancellation without email.
  Temporary hikers have no login; do not invent a browser session for them.
- `server/test/usecases/cancelBooking*.test.js`, `test/domain/bookingCancelledEmail.test.js`
  and `test/dto/cancelBooking.test.js`: injected timestamps, error translation,
  notification failures, timezone formatting, escaping and exhaustive parser cases.
  Browser tests add user interaction and real Mailpit delivery, not duplicate every unit case.
- Scenarios 6's historical check and 9–10's rejection requests are API/server-level
  assertions. Scenario 11's controlled failures and optional response-order case
  are UI contracts; never report them as proof of backend fault handling or races.
- The 22 E2E tests cover all 12 numbered scenarios; S4 also checks the multi-booking
  variant of S12. S11 implements the controlled HTTP 500 and real retry; transport
  abort and the optional out-of-order list response are not implemented test cases.
- Displayed date assertions use the client's fixed weekday/month abbreviations,
  including **Sep**, rather than locale-dependent **Sept**. Dates are civil meal
  dates; cancellation timestamps separately use the Europe/Rome timezone.

## Implementation/mockup discrepancies and review points

1. The mockup confirmation says **will be freed for other guests. We will email
   you a confirmation.** QA's actual dialog says only **will be cancelled.**
   Scenario 2 records the actual text, without silently amending the approved mockup.
2. The mockup lists generic `404` copy; QA closes the cancellation dialog and shows
   **This booking is no longer in your list.** The stale `422` copy is the server
   message with punctuation, not an invented cancellation error code.
3. The page says cancelled and past bookings are not listed, but the API/DAO use
   `service_date >= today`: meals earlier today may still appear. Previous dates
   are absent. This is a product/copy review point, not a reason to add a frontend cutoff.
4. The success notice always says **We emailed you a confirmation.**, even though
   the API deliberately retains cancellation after SMTP failure. Capture delivery
   separately; do not infer it from that notice or introduce a new API field.
5. The email mockup's phrase **the booking no longer exists** refers to active
   reservations, not physical deletion. The row, table assignments and dietary
   history remain stored, although dietary details are excluded from the email.
6. The mockup's cancellation-API open question and email screen numbers are stale:
   DELETE is implemented/documented, and the current booking mockup numbers its
   cancellation screens 11–12. These source documents are left unchanged here.

## Sources

- [Official MH-08 story and PO clarification](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-08.md)
- [Booking page mockup](../mockups/hiker-booking-page/README.md)
- [Cancellation email mockup, email 4](../mockups/emails/README.md#4-booking-cancelled-mh-08)
- [API contract](../openapi.json)
- [Booking page](../../client/src/pages/MyBookingsPage/MyBookingsPage.jsx),
  [card](../../client/src/components/BookingCard/BookingCard.jsx),
  [cancellation dialog](../../client/src/components/CancelBookingDialog/CancelBookingDialog.jsx)
- [Cancellation hook](../../client/src/hooks/useCancelBooking.js),
  [list state](../../client/src/hooks/useMyBookings.js),
  [cancellation texts](../../client/src/lib/cancelBooking.js),
  [API client](../../client/src/api/bookings.js)
- [Cancellation rules](../../server/src/usecases/cancelBooking.js),
  [notification](../../server/src/usecases/cancelBookingAndNotify.js),
  [DAO](../../server/src/dao/bookings.js),
  [formatter](../../server/src/domain/bookingConfirmation.js),
  [controllers](../../server/src/controllers/bookings.js)
- [PR #119 integration evidence at the reviewed commit](https://github.com/SteAlve/SE2-project-team16-mountain-hut/blob/c9d3a470389f3f4cd4f8b8f03ccb5ba22058df58/server/test/api/cancelBooking.test.js)
- [MH-03 Mailpit conventions](../../e2e/tests/mh-3-receive-confirmation.spec.js),
  [Playwright configuration](../../e2e/playwright.config.js),
  [server launcher](../../e2e/start-server.js), [CI services](../../.github/workflows/ci.yml)
