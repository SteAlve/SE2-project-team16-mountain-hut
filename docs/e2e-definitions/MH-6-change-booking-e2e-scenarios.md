# MH-6 - Change a booking

These end-to-end scenarios cover the hiker's booking-change flow. They follow
Given/When/Then form so they can be translated directly into Playwright tests.
Booking cancellation belongs to MH-08 and is not covered here.

The scenarios derive from each supported change, the product owner's
clarifications, and the agreed MH-6 booking-management mockup. Each verifies
the result visible to the hiker and, where relevant, that a refused or
abandoned change leaves the saved booking unchanged.

## Frontend contract for E2E testability

The frontend may use any component structure, but it must expose the following
observable behavior:

1. The hiker can open **My bookings** and see their active bookings.
2. Each booking has an accessible **Edit** action.
3. The edit form has accessible controls for the date, time, party size, and
   dietary requirements, populated with the saved booking values.
4. The form has accessible **Save changes** and **Cancel** actions.
5. Saving shows a visible pending state until the server responds. On success,
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
8. Time-sensitive scenarios use the hut's local time and a controlled test
   clock. They do not depend on the machine's current date or time.

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

## Scenario 1: The edit form shows saved values and cancelling discards edits

**Given**

1. A hiker is logged in and has an active booking.
2. The booking's reference, date, time, party size, dietary requirements, and
   assigned tables are recorded.

**When**

1. The hiker opens **My bookings** and selects **Edit** for the booking.
2. The hiker checks the values shown in the edit form.
3. The hiker changes at least one value and selects **Cancel** without saving.
4. The hiker reloads or reopens **My bookings**.

**Then**

1. Before editing, the form shows the booking's saved values.
2. After cancelling, the booking still shows its original values and assigned
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
   without changing party size or dietary requirements.
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

## Scenario 5: Changing dietary requirements keeps the table allocation

**Given**

1. A hiker is logged in and has an active booking more than 48 hours away.
2. The booking has dietary requirements and an assigned table allocation.
3. The booking reference, date, time, party size, and assigned tables are
   recorded.

**When**

1. The hiker opens **Edit** for the booking.
2. The hiker changes only the dietary requirements and selects **Save changes**.
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

## Scenario 7: A change is refused when the original meal is less than 48 hours away

**Given**

1. A hiker is logged in and has an active booking whose original meal starts
   less than 48 hours after the controlled test clock.
2. If the hiker were allowed to move it, the destination meal would be more
   than 48 hours away and have enough free seats.
3. The booking's original values and allocation are recorded.
4. There is no previous change email for this booking in the E2E email service.

**When**

1. The hiker attempts to change the booking to the destination slot and selects
   **Save changes**.
2. The hiker reloads or reopens **My bookings**.

**Then**

1. The change is refused and the UI shows a visible error.
2. The booking retains its original values and allocation after reload.
3. No change email is sent.

## Scenario 8: A move is refused when the destination meal is less than 48 hours away

**Given**

1. A hiker is logged in and has an active booking whose original meal starts
   more than 48 hours after the controlled test clock.
2. The destination meal starts less than 48 hours after the test clock and has
   enough free seats.
3. The booking's original values and allocation are recorded.
4. There is no previous change email for this booking in the E2E email service.

**When**

1. The hiker attempts to move the booking to the destination slot and selects
   **Save changes**.
2. The hiker reloads or reopens **My bookings**.

**Then**

1. The move is refused and the UI shows a visible error.
2. The booking retains its original values and allocation after reload.
3. No change email is sent.

## Scenario 9: Changes are allowed at exactly the 48-hour boundary

Run this scenario with each data set:

1. The original meal starts exactly 48 hours after the controlled test clock;
   change only the party size or dietary requirements.
2. The original meal starts more than 48 hours after the clock and the
   destination meal starts exactly 48 hours after it; change the date and time.

**Given**

1. A hiker is logged in and has an active booking.
2. The test clock and meal start times match one of the data sets above.
3. Where the party size or slot changes, enough seats are available.

**When**

1. The hiker makes the change for the selected data set and selects
   **Save changes**.

**Then**

1. The change succeeds at the exact 48-hour boundary.
2. The changed values are saved and remain correct after reload.
3. If the slot or party size changed, the system assigns seats according to
   MH-01 and releases the old allocation.

## Scenario 10: A hiker cannot change another hiker's booking

**Given**

1. Two hiker accounts exist, each with a separate active booking.
2. The first hiker is logged in and opens **My bookings**.
3. Both bookings' original values and allocations are recorded.

**When**

1. The first hiker attempts to open or submit a change for the second hiker's
   booking, for example by navigating directly to its edit URL if the UI
   supports one.
2. The first hiker reloads or reopens **My bookings**.

**Then**

1. The first hiker cannot view or change the second hiker's booking.
2. The first hiker's booking list and the second hiker's saved booking remain
   unchanged.
3. No change email is sent to either hiker.

## Sources

- [MH-06 story](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-06.md)
- [MH-06 48-hour rule clarification, issue #43](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/43)
- [MH-06 party-size and seat reassignment clarification, issue #38](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/38)
- [MH-06 change email clarification, issue #41](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/41)
- [MH-01 seat assignment clarification, issue #11](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/11)
- MH-6 frontend mockup task, [MH-89](https://polito-se2-26-16.youtrack.cloud/issue/MH-89/Frontend-Mockup)
- [Dietary needs behavior, MH-05 mockup](../mockups/dietary/README.md)
