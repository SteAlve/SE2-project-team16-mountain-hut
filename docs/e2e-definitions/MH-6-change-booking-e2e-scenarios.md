# MH-6 - Change a booking

These scenarios cover the hiker's booking-change flow. They follow
Given/When/Then form for browser E2E tests and explicitly identified API/server-level
checks where the UI prevents the action or an exact server-clock boundary is needed.
Booking cancellation belongs to MH-08 and is not covered here.

The scenarios derive from each supported change, the product owner's
clarifications, and the agreed MH-6 booking-management mockup. Each verifies
the result visible to the hiker and, where relevant, that a refused or
abandoned change leaves the saved booking unchanged.

## Frontend contract for E2E testability

The frontend may use any component structure, but it must expose the following
observable behavior:

1. The hiker can open **My bookings** and see their active bookings.
2. Each booking has an accessible **Edit** action, disabled when changes are closed,
   with the visible text **Changes closed on…** and the deadline.
3. The edit form is a **Change your booking** dialog, populated with the saved
   values. Identify date and time choices by their accessible **radio** roles and
   visible day/time labels; identify party size and dietary controls by their
   accessible roles and labels.
4. The dialog has accessible **Save changes** and **Close** actions.
5. Saving shows **Saving…** with the **Save changes** action disabled until the
   server responds. On success,
   the saved booking is displayed with its updated values without requiring a
   full page reload.
6. On rejection, the UI shows a visible error and does not present unsaved
   values as saved.
7. Tests identify controls by accessible role, label, and user-facing text,
   not by CSS classes or element positions.
8. Tests wait for visible completion or error states; fixed sleeps are not
   sufficient.

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
   zone. Browser time does not control server time. Browser scenarios use fixtures
   comfortably inside or outside the window; exact-boundary assertions use a fixed
   server-side clock, as specified in Scenario 9.

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
   browser/server clock control. Do not use browser clock mocking to claim that
   the server is at an exact deadline. Scenario 9 uses the existing change use
   case's injected clock for deterministic server-level assertions; an HTTP E2E
   version requires server-clock control that is not currently provided.

## Scenario 1: The edit dialog shows saved values and closing discards edits

**Given**

1. A hiker is logged in and has an active booking.
2. The booking's reference, date, time, party size, dietary requirements, and
   assigned tables are recorded.

**When**

1. The hiker opens **My bookings** and selects **Edit** for the booking.
2. The hiker checks the values shown in the edit form.
3. The hiker changes at least one value and selects **Close** without saving.
4. The hiker reloads or reopens **My bookings**.

**Then**

1. Before editing, the form shows the booking's saved values.
2. After closing the dialog, the booking still shows its original values and assigned
   tables.
3. The same original values are shown after reload.
4. No change email is sent.

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
   using the radios identified by their visible day/time labels, without changing
   party size or dietary requirements. For a date-only change, preserve the selected
   start time when the new date offers an eligible slot with that start time.
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

Date-selection fallback: if the new date has no eligible slot at the saved start
time, the time remains unselected and **Save changes** is disabled. No change is
submitted until the hiker selects an eligible time radio. Closing the dialog at
this point preserves the original booking and sends no change email.

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
2. The hiker increases the party size to `6` and selects **Save changes**.
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
2. The hiker reduces the party size to `2` and selects **Save changes**.
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

1. The hiker attempts to reduce the party to `2` while keeping all `3` entries.
2. Separately, an authenticated API request attempts the same reduction with
   `PATCH /api/bookings/:bookingId` and body `{"partySize": 2}`, omitting
   `requirements` so the server checks the existing entries.

**Then**

1. The UI prevents submission of the invalid combination until the number of
   guests with requirements is reduced to at most `2`; do not force a disabled action.
2. The API request returns `422 Unprocessable Entity` because the retained
   requirements exceed the new party size.
3. Both prevented/rejected attempts leave the original booking and allocation
   unchanged and send no change email.

## Scenario 5: Changing dietary requirements keeps the table allocation

**Given**

1. A hiker is logged in and has an active booking more than 48 hours away.
2. The booking has dietary requirements and an assigned table allocation.
3. The booking reference, date, time, party size, and assigned tables are
   recorded.

**When**

1. The hiker opens **Edit** for the booking.
2. The hiker changes only the dietary requirements and selects **Save changes**.
   The PATCH body contains `requirements` and omits both `slotId` and `partySize`.
3. The hiker reloads or reopens **My bookings**.

**Then**

1. The booking shows the new dietary requirements.
2. Its reference, date, time, party size, and table allocation remain
   unchanged.
3. The updated requirements remain saved after reload.
4. One change email is sent to the hiker with the updated booking details and
   requirements.

## Scenario 6: Increasing the party size is refused when there are not enough seats

**Given**

1. A hiker is logged in and has an active booking more than 48 hours away.
2. The slot does not have enough seats for the requested party size, even after
   the booking's current allocation is made available for reassignment.
   Calculate this capacity including the booking's own occupied seats: for example,
   `4` seats held by this booking plus `2` other free seats allow a party of `6`,
   but not `7`. Use the latter as the rejected request; a public availability count
   that excludes the original allocation is not sufficient to establish failure.
3. The booking's reference, date, time, party size, requirements, and table
   allocation are recorded.
4. There is no previous change email for this booking in the E2E email service.

**When**

1. The hiker opens **Edit**, increases the party size beyond the available
   capacity, and selects **Save changes**.
2. The hiker reloads or reopens **My bookings**.

**Then**

1. The change is refused and a visible error explains that there are not enough
   seats.
2. The booking retains its original reference, date, time, party size,
   requirements, and table allocation.
3. The original booking is still unchanged after reload.
4. The original seats have not been released.
5. No change email is sent.

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
   with the server clock fixed at `T + 1 ms`: the same request is rejected with
   `422`, the original booking and allocation remain unchanged, and no change
   email is sent. Verify the error's API mapping at server/API level.

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

## Sources

- [MH-06 story](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-06.md)
- [MH-06 48-hour rule clarification, issue #43](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/43)
- [MH-06 party-size and seat reassignment clarification, issue #38](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/38)
- [MH-06 change email clarification, issue #41](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/41)
- [MH-01 seat assignment clarification, issue #11](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/11)
- MH-6 frontend mockup task, [MH-89](https://polito-se2-26-16.youtrack.cloud/issue/MH-89/Frontend-Mockup)
- [Dietary needs behavior, MH-05 mockup](../mockups/dietary/README.md)
