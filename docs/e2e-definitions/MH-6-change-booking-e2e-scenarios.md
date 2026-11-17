# MH-6 - Change a booking

These scenarios cover the hiker's booking-change flow. They follow
Given/When/Then form for browser E2E tests and explicitly identified API/server-level
checks where the UI prevents the action or an exact server-clock boundary is needed.
Booking cancellation belongs to MH-08 and is not covered here.
Cancellation in another tab is used only as a stale-editor precondition below.

This Phase 1 definition was reviewed against `origin/qa` at `d03e63b`, including
the dietary popup from PR #115 promoted through PR #118. No Playwright tests are
implemented in this phase.

The scenarios derive from each supported change, the product owner's
clarifications, and the agreed MH-6 booking-management mockup. Each verifies
the result visible to the hiker and, where relevant, that a refused or
abandoned change leaves the saved booking unchanged.

## Frontend contract for E2E testability

The current QA frontend exposes the following observable behavior. Scope controls
to the relevant booking and dialog; these are accessible names, not CSS selectors.

1. The hiker can open **My bookings** and see their active bookings.
2. Each booking is a **listitem** named `Booking QUOTA-xxxxx` within the list
   **Your bookings**. Scope the **Edit** button to that item. It is disabled when
   changes are closed, with the visible text **Changes closed on…** and the deadline.
3. The edit form is a **Change your booking** dialog, populated with the saved
   values. Day and time choices are radio controls inside accessible
   **radiogroup** components; Playwright locates them by role and accessible name.
   A day radio is named like `Fri 20 Nov`. A time radio's name includes the range
   and available seats, for example `13:00 – 14:00 18 seats free`. Match the start
   of the time name: use `/^13:00/` for a slot starting at 13:00, not `/13:00/`,
   which also matches `12:00 – 13:00`. Party size is an accessible **group** named
   **How many people**, with **One fewer** and **One more** buttons. Identify
   dietary controls by their accessible roles and labels. The dialog's accessible
   name includes the reference: locate it with
   `getByRole('dialog', { name: /^Change your booking/ })`, not an exact title match.
4. In that dialog, **Dietary needs and allergies** contains folded lines with
   **Edit line N** and **Remove line N** buttons and **+ Add a guest's needs**.
   The add button is disabled when every guest is counted. Its accessible name
   normalizes the spacing after `+`; a name pattern such as
   `/^\+\s+Add a guest's needs$/` avoids depending on that spacing.
5. Adding or editing a line opens a separate native **dialog**, named
   **Add a guest’s needs** or **Edit a guest’s needs** (curly apostrophe).
   Locate the popup by that role and name; a pattern such as
   `/^(Add|Edit) a guest['’]s needs$/` accepts either apostrophe. It is a second
   modal layer, not an inline form or a child of the main dialog. While it is
   open, the underlying dialog is inert and may be absent from default role
   queries. Interact only with the popup, then locate the main dialog again after
   the popup closes; do not force interactions with the underlying dialog.
6. Within the popup, **Guests** is a **group** with **One fewer** and **One more**
   buttons. **Diet** and **Allergies** are separate **groups** containing toggle
   **buttons** with `aria-pressed`, not checkboxes. Scope **Other** to its group.
   The textboxes are labelled **Which diet?**, **Which allergy?**, and
   **Anything else the kitchen should know?**. Use labels or textbox roles with
   those names. **Cancel** or Esc restores the line as it was when opened, or
   removes a newly added line. **Done** validates that line and returns to the
   main dialog with the accepted local draft; it sends no PATCH and saves nothing
   to the server. Edits are held in local state while typing, with a snapshot for
   cancellation; Done is not a separate API operation.
7. Invalid **Done** keeps the popup open and shows the line/field validation
   message. Field errors expose `aria-invalid`; line errors are visible text,
   not necessarily an **alert**. The party-wide count message is separate from
   popup validation. **Done** does not validate the total against a reduced party;
   the main **Save changes** action checks the complete requirements.
8. The main dialog has accessible **Save changes** and **Close** buttons.
   **Close** (or Esc when no popup is open) discards the entire draft, including
   lines previously accepted with Done. With no changes, Save changes is disabled.
9. Saving renames the submit button to **Saving…** and disables it until the
   server responds; do not expect its accessible name to remain Save changes.
   On success, the saved booking is displayed with its updated values without a
   full page reload.
10. On rejection, the UI shows a visible error and does not present unsaved
    values as saved. Stale-booking errors close the editor, clear any success
    notice, show an **alert**, and reload the list, as specified under Scenario 6.
11. Tests identify controls by accessible role, label, and user-facing text,
    not by CSS classes or element positions.
12. Tests wait for visible completion or error states; fixed sleeps are not
    sufficient.
13. The modification flow loads `GET /api/slots` and may refresh it periodically.
    It does not request a seating preview. Only the main Save changes sends
    `PATCH /api/bookings/:bookingId`; its body contains only changed fields from
    `slotId`, `partySize`, and `requirements`, never client-selected tables.

## Shared constraints

1. The hiker is authenticated and can view and change only their own active
   bookings.
2. MH-06 allows changes to the date, time, party size, and dietary
   requirements. A field not changed by the hiker retains its saved value.
3. A change is allowed only if at least 48 hours remain before the original
   meal starts. The exact 48-hour boundary is included.
4. When moving a booking to another slot, at least 48 hours must remain before
   both the original and destination meals. The exact boundary is included for
   each slot.
   The UI offers only destination days and time slots eligible under this rule;
   this client-side filtering does not replace server-side deadline validation.
5. Changing the slot or party size triggers seat assignment again using the
   MH-01 rules. The booking's current seats are available during reassignment.
   If the new party cannot be seated, the change is refused and the original
   booking remains as it was.
6. Changing dietary requirements alone does not trigger seat reassignment; the
   existing table allocation is kept.
7. Every successful change is notified to the hiker by email, as confirmed in
   [issue #41](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/41).
   A rejected or abandoned change does not send a successful-change email.
8. The server enforces the 48-hour deadline using its clock and the hut's time
   zone. Browser and server clocks may differ; browser time does not control
   server time. Browser scenarios use fixtures comfortably inside or outside the
   window; exact-boundary assertions use the existing injected server clock, as
   specified in Scenario 9. Do not assume additional API response fields or
   clock-synchronization infrastructure.

## Test data and environment

1. Use a unique hiker account and booking per scenario, or reset the account's
   bookings and captured email messages before the scenario starts.
2. Create the required slots, table capacities, and any other bookings through
   test setup. Do not rely on pre-existing demo data.
3. Record the booking reference, date, time, party size, requirements, and
   assigned tables before a change when the scenario checks that values remain
   unchanged.
4. Capture outgoing email in the E2E email service, such as Mailpit. A message
   from an earlier test must not satisfy an assertion.
5. For persistence checks, reload or reopen **My bookings** and verify the
   saved booking rather than relying only on the editor's displayed values.
6. The current E2E setup starts a separate server process and provides no shared
   browser/server clock control; their clocks may differ. Do not use browser clock
   mocking to claim that the server is at an exact deadline. Scenario 9 uses the
   existing change use case's injected clock for deterministic server-level
   assertions; an HTTP E2E version requires server-clock control that is not
   currently provided.
7. Start request observation before the relevant action and record an email
   baseline after fixture creation, excluding the original booking confirmation.
   For actions that must not send a PATCH, check the requests observed through
   popup/dialog completion and verify unchanged data through authenticated
   `GET /api/bookings` or a database fixture helper. Compare captured change emails
   for this reference against the baseline; do not use a fixed sleep to prove absence.
8. Server/API checks in Scenarios 4 and 7–10 are explicitly separate from browser
   interactions. Reuse existing unit/integration coverage for deterministic rules
   where possible. Race coverage below needs controlled overlapping server requests;
   a browser response stub can check UI error handling but cannot prove a backend race.

## Scenario 1: The edit dialog shows saved values and closing discards edits

**Given**

1. A hiker is logged in and has an active booking more than 48 hours away.
2. The booking's reference, date, time, party size, dietary requirements, and
   assigned tables are recorded.
3. At least one saved dietary line exists. Leave an uncounted guest if also
   exercising the new-line cancellation variant.

**When**

1. The hiker opens **My bookings** and selects **Edit** for the booking.
2. The hiker checks the values shown in the edit form.
3. The hiker changes a normal booking value, such as party size, without saving.
4. The hiker selects **Edit line N** in the main dialog and changes that saved
   line inside **Edit a guest’s needs**. Run independently with **Cancel** and Esc:
   only the popup closes and the previous line, guest count, and needs are restored.
5. With capacity for another line, repeat with **+ Add a guest's needs** and
   Cancel/Esc; the new line disappears and the previous count is restored.
6. Reopen an existing line, make a valid dietary change, and select **Done**.
   Verify the local line changes in the main dialog, then select its **Close**
   button without selecting Save changes.
7. The hiker reloads or reopens **My bookings** and opens Edit again.

**Then**

1. Before editing, the form shows the booking's saved values.
2. Popup Cancel/Esc discards only the current line edit and leaves the main
   dialog open with the other draft choices intact. It is distinct from main Close.
3. Main Close discards both the normal booking change and the dietary change
   accepted locally with Done. The booking retains its original values and tables.
4. The original values, including requirements, are shown in the list and reopened
   editor after reload and in the authenticated API/database verification.
5. No PATCH is sent during these actions, and no successful-change email is sent.

## Scenario 2: A hiker changes the date or time

Run this scenario with each data set:

1. Change only the date to a different date with a slot at the same time.
2. Change only the time to a different slot on the same date.

**Given**

1. A hiker is logged in and has an active booking whose original meal and a
   different destination meal are both more than 48 hours away.
2. The destination slot has enough free seats for the existing party.
3. The party size, dietary requirements, booking reference, and original table
   allocation are recorded.
4. There is no previous change email for this booking in the E2E email service.

**When**

1. The hiker opens **Edit** for the booking.
2. The hiker changes only the date or time specified by the selected data set,
   using the radio controls in their accessible radiogroups, located by role and
   the day/time names described in the frontend contract, with time names matched
   from the start, without changing party size or dietary requirements. For a
   date-only change, preserve the selected start time when the new date offers an
   eligible slot with that start time that is not marked **Full**.
3. The hiker selects **Save changes**.
4. The hiker reloads or reopens **My bookings**.

**Then**

1. The same booking reference shows the date or time specified by the selected
   data set.
2. The date or time not selected for change, party size, and dietary
   requirements remain unchanged.
3. The party has a valid seat allocation at the destination slot according to
   MH-01.
4. Seats previously assigned to this booking are available at the original
   slot.
5. The updated booking remains saved after reload.
6. One change email is sent to the hiker. Its recipient is the hiker, its
   subject identifies the booking as changed, and its body contains the same
   booking reference, new date, new time, party size, and change time. The
   message makes clear that the new details replace the earlier details for
   that reference.

Date-selection fallback: QA keeps the same start time only when that slot passes
the displayed deadline filter and has at least one available seat. This is not a
guarantee that the whole party fits; the backend decides on Save changes. If the
new date has no eligible slot at the saved start time, including when a slot at
that start time exists but is marked **Full**, do not preserve or automatically
select it. No time remains selected and **Save changes** is disabled until the
hiker selects an eligible time radio. Closing the dialog at this point preserves
the original booking and sends no change email. This differs from the invalid
dietary-requirement combination in Scenario 4: there, **Save changes** remains
enabled, but client-side validation blocks the PATCH request.

## Scenario 3: Increasing the party size succeeds and reassigns tables

**Given**

1. A hiker is logged in and has an active booking for `4` people in a slot
   more than 48 hours away.
2. The booking uses `4` seats at table A, which has `6` seats; another booking
   uses the remaining `2` seats at table A.
3. Table C has `6` free seats in the same slot.
4. The hiker's original booking reference, party size, requirements, and table
   allocation are recorded.

**When**

1. The hiker opens **Edit** for the booking.
2. The hiker increases the party size to `6` using **One more** in the
   **How many people** group and selects **Save changes**.
3. The hiker reloads or reopens **My bookings**.

**Then**

1. The same booking reference shows a party size of `6`.
2. The system reassigns the party to table C, since the original table cannot
   fit all `6` people after the other booking's seats are accounted for.
3. The original `4` seats at table A become available.
4. The saved party size and table allocation remain correct after reload.
5. One change email is sent to the hiker with the same booking reference and
   updated details.

## Scenario 4: Decreasing the party size releases seats

**Given**

1. A hiker is logged in and has an active booking for `4` people in a slot
   more than 48 hours away.
2. The booking's reference, original party size, requirements, and table
   allocation are recorded.
3. The booking has at most `2` existing dietary requirement entries.

**When**

1. The hiker opens **Edit** for the booking.
2. The hiker reduces the party size to `2` using **One fewer** in the
   **How many people** group and selects **Save changes**.
3. The hiker reloads or reopens **My bookings** and checks availability for
   the same slot.

**Then**

1. The same booking reference shows a party size of `2`.
2. The booking has a valid allocation for `2` people according to MH-01.
3. The seats no longer needed by this booking are available to another party.
4. The saved party size and availability remain correct after reload.
5. One change email is sent to the hiker with the updated party size.

### Existing requirements exceed the reduced party size

**Given**

1. An editable booking for `4` people has `3` dietary requirement entries
   (counting individual guests, including entries expanded from grouped needs).
2. Its original values and allocation are recorded and captured emails are cleared.

**When**

1. The hiker reduces the party to `2` while keeping all `3` entries and clicks
   the enabled **Save changes** button.
2. Separately, an authenticated API request attempts the same reduction with
   `PATCH /api/bookings/:bookingId` and body `{"partySize": 2}`, omitting
   `requirements` so the server checks the existing entries.

**Then**

1. **Save changes** remains enabled, and the UI displays the red validation message
   `more than your party: remove a line or lower its guests`.
2. Clicking **Save changes** sends no `PATCH /api/bookings/:bookingId` request.
   The browser E2E test verifies both the visible validation message and that no
   PATCH request was sent.
3. The separate API request returns `422 Unprocessable Entity` because the retained
   requirements exceed the new party size.
4. Both prevented/rejected attempts leave the original booking and table allocation
   unchanged and send no change email.
5. This is party-wide validation in the main dialog, not an invalid-popup-line
   case: valid individual lines can still count too many guests after a party
   reduction. The counter shows the message; no guest popup needs to open solely
   because the total is too high. Remove a line or use **Edit line N**, lower its
   **Guests**, and select **Done** before attempting a valid Save changes.

## Scenario 5: Changing dietary requirements keeps the table allocation

**Given**

1. A hiker is logged in and has an active booking more than 48 hours away.
2. The booking has dietary requirements and an assigned table allocation, with
   uncounted guests available for the add-line variant.
3. The booking reference, date, time, party size, and assigned tables are
   recorded.

**When**

1. The hiker opens **Edit** for the booking.
2. The hiker selects **+ Add a guest's needs** or the relevant **Edit line N**.
   Run add and edit as independent variants, locating the corresponding popup.
3. In the popup, the hiker changes diets, allergies, **Guests**, or **Other requests**
   through their groups and labels, keeping the line valid and the total within
   party size. A line of N guests represents N requirements, not one API entry.
4. The hiker selects **Done**. The popup closes and the main dialog shows the
   updated folded line/chips/count. Verify no PATCH or change email and confirm
   through API/database verification that the saved booking is still unchanged.
5. The hiker selects **Save changes** in the main dialog. Observe exactly one
   `PATCH /api/bookings/:bookingId` with precisely the intended `requirements`;
   `slotId`, `partySize`, tables, UI line keys, guest counts, `OTHER` preset codes,
   and the derived `hasAllergies` flag are not request fields. Grouped lines expand
   to one requirement per guest; Other choices send their description fields.
6. Wait for the successful response and refreshed list, then reload or reopen
   **My bookings** and Edit to verify the saved requirements.

**Then**

1. The booking shows the new dietary requirements.
2. Its reference, date, time, party size, and table allocation remain
   unchanged.
3. The updated requirements remain saved after reload.
   Verify retained slot ID and table/seat assignments through the API/database;
   no seating-preview request is made. The dialog shows
   **Only the dietary needs changed. No availability check is needed and your tables stay the same.**
   before saving and **Day, time and tables unchanged.** in its footer.
4. One change email is sent to the hiker with the updated booking details and
   requirements, the same reference and change time, and the explanation that
   the new details replace the earlier ones. The list shows
   `Booking QUOTA-xxxxx changed. We emailed you the new details.` only after success.

### Popup validation and recovery

Run with independent drafts under the same editable-booking preconditions:

1. Add an empty line, or edit an existing line and remove every diet, allergy,
   and request. On Done, expect
   `Choose a diet or an allergy, or write a request, or remove this line.`
2. In the popup's **Allergies** group, select **Other** and leave **Which allergy?**
   empty. On Done, expect `Write which allergy, or unselect Other.` beneath the
   invalid textbox. This selection is not a valid completed requirements line.

**Given**

1. The booking's saved requirements, tables, and email baseline are recorded.
2. The selected invalid draft is open in the guest popup; a new-line variant has
   room for another counted guest.

**When**

1. The hiker selects **Done** with the chosen invalid draft.
2. After inspecting the error, the hiker corrects the line: choose a diet/allergy
   or enter a request for the empty-line case; enter an allergy description (or
   unselect Other while keeping another valid need) for the Other-allergy case.
3. The hiker selects **Done** again. Before any main Save changes, independently
   recreate each invalid draft and its failed Done, then select Cancel/Esc on an
   existing line and on a newly added line.

**Then**

1. Invalid Done leaves the guest popup open with the corresponding visible
   message. No PATCH, persisted change, or change email occurs.
2. Corrected Done closes the popup and keeps the valid line in the main local
   draft, still without a PATCH, persisted change, or change email.
3. Cancel/Esc restores an existing line or removes a new line, leaving the main
   dialog open. No PATCH or change email is generated by either action.
4. Only a subsequent valid main Save changes may persist the draft and send the
   single change email; closing the main dialog instead discards it, as in Scenario 1.

## Scenario 6: Increasing the party size is refused when there are not enough seats

The currently selected slot remains selectable in the edit dialog even when its
available seats are below the requested party size. Its displayed seat count adds
the booking's occupied seats to the public `GET /api/slots` `freeSeats`; these
seats also count as available for backend reassignment.

**Given**

1. A hiker is logged in and has an active booking more than 48 hours away.
2. The slot does not have enough seats for the requested party size, even after
   the booking's current allocation is made available for reassignment. Calculate
   this capacity including the booking's own occupied seats: for example,
   `4` seats held by this booking plus `2` other free seats allow a party of `6`,
   but not `7`. Use the latter as the rejected request; a public availability count
   that excludes the original allocation is not sufficient to establish failure.
3. The booking's reference, date, time, party size, requirements, and table
   allocation are recorded.
4. There is no previous change email for this booking in the E2E email service.

**When**

1. The hiker opens **Edit** and increases the party size beyond the total capacity
   available for reassignment. The current slot remains selectable even though
   its displayed capacity, including their own seats, is below that requested
   party size. The hiker selects **Save changes**.
2. The hiker reloads or reopens **My bookings**.

**Then**

1. The change is refused with `NO_SEATS`, and a visible error explains that there
   are not enough seats.
2. The booking retains its original reference, date, time, party size,
   requirements, and table allocation.
3. The original booking is still unchanged after reload.
4. The original seats have not been released.
5. No change email is sent; the failed change leaves the booking, table allocation,
   and email state unchanged.

### Destination already booked

**Given**

1. The hiker already owns another active booking in the otherwise eligible
   destination slot. Both meals satisfy the original/destination 48-hour rules,
   and the destination has spare seats so lack of capacity does not mask the rule.
2. Both bookings and the captured-email baseline are recorded.

**When**

1. In the main change dialog, the hiker chooses that destination and selects
   Save changes, producing a valid PATCH with the destination `slotId`.

**Then**

1. PATCH returns `422` with `You already have a booking for this slot`.
2. The editor stays open, retains the draft choices, and shows
   `You already have a booking for this slot. Choose another day or time.`
3. Both saved bookings and allocations remain unchanged after reload/API
   verification, and no successful-change email is sent.

### Stale editor after a change or cancellation in another tab

**Given**

1. Tab A has an editable booking open in Change your booking with a valid
   unsaved draft; both browser contexts belong to the same hiker.
2. The booking and email baseline are recorded. Run independently with another
   modification and with an external cancellation of this booking.

**When**

1. For the modification race, coordinate overlapping saves in tabs A and B so
   both server operations read the original booking and B's slot/party-size
   change commits first. A successful earlier save completed before A's server
   read does not by itself guarantee `409 BOOKING_CHANGED`; the API has no version field.
2. For the cancellation variant, cancel through tab B's setup/API action while
   A's editor is open, then submit A's draft. This is an MH-06 stale-change check;
   it does not test the MH-08 cancellation dialog, seats, or cancellation email.
3. Observe A's rejected PATCH and the following `GET /api/bookings` refresh.

**Then**

1. In the coordinated modification race, the losing PATCH returns
   `409` with `code: BOOKING_CHANGED`. QA closes A's editor and shows:
   `This booking was changed in the meantime, so nothing was saved. Its new details are below: open it again to change it.`
2. After cancellation, the current backend returns `422` with
   `This booking was cancelled`. QA closes A's editor and shows:
   `This booking was cancelled, so nothing was saved.`
   If the change instead receives a genuine `404` for a no-longer-found booking,
   QA also closes it and shows:
   `This booking is no longer in your list, so nothing was saved.`
   Cancellation keeps the historical row, so 404 is a separate not-found path,
   not the expected status for that retained cancelled row.
3. The refreshed list shows the winning modification, or excludes the cancelled
   booking. Reopening an editable surviving booking starts from the saved values.
4. No successful-change notice or extra change email belongs to A's rejected
   attempt. Exclude B's successful-change or cancellation email from that negative
   assertion by comparing against the captured reference/type/baseline.

Deterministic overlapping backend operations are not provided by the current E2E
harness. Keep the race guarantee in existing server integration coverage or add
explicit coordination in Phase 2; do not rely on tab-click timing or sleeps.
A controlled 409/422/404 response may verify the browser's close/refresh/message
behavior separately, but is not evidence of a real server conflict.

## Scenario 7: Edit is disabled when the original meal is less than 48 hours away

**Given**

1. A hiker is logged in and has an active booking whose original meal starts
   comfortably less than 48 hours after the server's current time.
2. If the hiker were allowed to move it, the destination meal would be more
   than 48 hours away and have enough free seats.
3. The booking's original values and allocation are recorded.
4. There is no previous change email for this booking in the E2E email service.

**When**

1. The hiker opens **My bookings** and inspects the booking without forcing a
   click on its disabled **Edit** action or attempting a nonexistent edit URL.
2. Separately, an authenticated API request sends
   `PATCH /api/bookings/:bookingId` with the otherwise valid destination `slotId`.
3. The hiker reloads or reopens **My bookings**.

**Then**

1. **Edit** is disabled and the booking displays **Changes closed on…** with
   its deadline; the UI does not open the edit dialog or submit a change.
2. The API-level attempt returns `422 Unprocessable Entity`, verifying that
   the server independently enforces the deadline.
3. The booking retains its original values and allocation after reload.
4. No change email is sent.

## Scenario 8: API rejects a destination meal less than 48 hours away

This is an API-level scenario: the UI does not allow selecting this destination.

**Given**

1. A hiker is logged in and has an active booking whose original meal starts
   comfortably more than 48 hours after the server's current time.
2. The destination meal starts comfortably less than 48 hours after server time and has
   enough free seats.
3. The booking's original values and allocation are recorded.
4. There is no previous change email for this booking in the E2E email service.

**When**

1. Using the hiker's authenticated session, send
   `PATCH /api/bookings/:bookingId` with the destination `slotId`, bypassing
   the UI selector rather than attempting to select a disabled option.
2. The hiker reloads or reopens **My bookings**.

**Then**

1. The API returns `422 Unprocessable Entity` for the destination deadline.
2. The booking retains its original values and allocation after reload.
3. No change email is sent.

## Scenario 9: Server allows changes at exactly the 48-hour boundary

Verify this deterministically at server level using the change use case's existing
injected clock fixed at instant `T`. The running E2E server does not currently
expose clock synchronization; browser clock mocking alone cannot verify this rule.

Run this scenario with each data set:

1. The original meal starts exactly 48 elapsed hours after `T`;
   change only the party size or dietary requirements.
2. The original meal starts more than 48 elapsed hours after `T` and the
   destination meal starts exactly 48 elapsed hours after `T`; change the slot.

**Given**

1. A hiker is logged in and has an active booking.
2. The fixed server-side clock and meal start instants match one of the data sets
   above, converted using the hut's time zone. The clock remains at `T` throughout
   the operation, so execution delay cannot cross the boundary.
3. Where the party size or slot changes, enough seats are available.

**When**

1. Execute the change use case for the authenticated hiker and selected data set
   with the injected clock fixed at `T`. No browser click or real-time sleep is used.

**Then**

1. The change succeeds at the exact 48-hour boundary.
2. Re-read the saved booking and verify the changed values.
3. If the slot or party size changed, the system assigns seats according to
   MH-01 and releases the old allocation.
4. As a separate negative boundary case, repeat from a fresh original fixture
   with the server clock fixed at `T + 1 ms`. For each data set, keep the meal
   start instants unchanged and perform the same otherwise valid booking-change
   operation as the booking's actual owner. The change is rejected with `422`,
   the original booking and allocation remain unchanged, and no change email is
   sent. Verify the error's API mapping at server/API level.

## Scenario 10: A hiker cannot change another hiker's booking

Use an API-level authorization attempt; editing is a dialog, not a direct edit URL.

**Given**

1. Hiker A and Hiker B each have a separate active booking more than 48 hours away.
2. Hiker A is logged in and opens **My bookings**.
3. Both bookings' original values and allocations are recorded.

**When**

1. Using Hiker A's authenticated session, send
   `PATCH /api/bookings/:bookingId` targeting Hiker B's booking with an otherwise
   valid party-size change.
2. Re-read each saved booking through its owner's authenticated booking list
   and reload Hiker A's **My bookings** page.

**Then**

1. The API returns `404 Not Found`, rather than `403`, without exposing Hiker B's
   booking. Hiker A's list contains only Hiker A's bookings.
2. Both bookings retain all their original values and table allocations.
3. No change email is sent to either hiker.

## QA differences and remaining review points

1. The hiker-booking mockup says **This booking was changed in the meantime.
   Reload it and try again.** and describes a manual reload. QA instead closes the
   editor, reloads automatically, and uses the longer explanation recorded under
   Scenario 6 (`changeFailure`, `useChangeBooking`, `useMyBookings`). The scenarios
   describe the observable implementation; the wording/flow difference remains
   for product/mockup review, rather than treating the mockup as silently amended.
2. The mockup maps booking/slot `404` to the generic error. QA treats any PATCH
   `404` as stale and displays **This booking is no longer in your list, so nothing
   was saved.** This can also be misleading for a missing destination slot while
   the original booking still exists. Keep the actual response/message distinction
   explicit instead of asserting the mockup's generic message.
3. `BOOKING_CHANGED` is an overlapping-operation safeguard: the DAO compares the
   slot and party size read before its row lock. There is no browser-held version
   or requirements comparison. A sequential stale-tab save, or two dietary-only
   changes, need not be rejected as a conflict. Broader stale-edit protection would
   need a separate implementation/requirements decision; do not claim it here.
4. The successful-change notice always says **We emailed you the new details.**
   The backend logs notification failures but still accepts the change, as the API
   contract specifies. Assert actual delivery with the healthy captured-mail
   fixture; the notice alone does not prove delivery. This wording remains a
   review point when mail fails, without inventing a delivery-status response field.

## Sources

- [MH-06 story](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-06.md)
- [MH-06 48-hour rule clarification, issue #43](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/43)
- [MH-06 party-size and seat reassignment clarification, issue #38](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/38)
- [MH-06 change email clarification, issue #41](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/41)
- [MH-01 seat assignment clarification, issue #11](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/11)
- MH-6 frontend mockup task, [MH-89](https://polito-se2-26-16.youtrack.cloud/issue/MH-89/Frontend-Mockup)
- [Dietary needs behavior, MH-05 mockup](../mockups/dietary/README.md)
- [Hiker booking page mockup](../mockups/hiker-booking-page/README.md)
- [PATCH request/response contract](../openapi.json)
- [Booking page](../../client/src/pages/MyBookingsPage/MyBookingsPage.jsx),
  [booking card](../../client/src/components/BookingCard/BookingCard.jsx),
  [main dialog](../../client/src/components/ChangeBookingDialog/ChangeBookingDialog.jsx),
  and [guest popup](../../client/src/components/GuestNeedsDialog/GuestNeedsDialog.jsx)
- [Dietary lines](../../client/src/components/DietaryNeeds/DietaryNeeds.jsx),
  [guest controls](../../client/src/components/GuestNeedsEditor/GuestNeedsEditor.jsx),
  and [modal behavior](../../client/src/components/Modal/Modal.jsx)
- [Booking-list state](../../client/src/hooks/useMyBookings.js),
  [change submission](../../client/src/hooks/useChangeBooking.js),
  and [dietary draft/rollback](../../client/src/hooks/useDietaryNeeds.js)
- [Change payloads/messages](../../client/src/lib/changeBooking.js),
  [dietary validation/serialization](../../client/src/lib/dietaryNeeds.js),
  [backend rules](../../server/src/usecases/changeBooking.js),
  [concurrent-update checks](../../server/src/dao/bookings.js),
  and [change notifications](../../server/src/usecases/changeBookingAndNotify.js)
