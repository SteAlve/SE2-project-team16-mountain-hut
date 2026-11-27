# MH-9 - Repeat a weekly schedule

These end-to-end scenarios cover the employee's weekly schedule copy flow. They
use Given/When/Then form so that they can be translated directly into Playwright
tests.

The operation copies the meal slots of one selected seven-day period into one
or more destination intervals. A period starts on the selected date and covers
that date plus the following six days; it is not required to start on Monday.
Destination intervals contain one or more aligned seven-day periods after the
source, and may be contiguous or non-consecutive. The operation does not copy
source bookings or create duplicate table sets. A destination period with
active bookings cannot be replaced; cancelled bookings in a replaceable
destination are deleted with its old slots.

> **Implementation note:** Review and update these scenarios after both the
> frontend and backend implementations are available together in `dev`, before
> translating them into executable E2E tests.

## Frontend contract for E2E testability

The implementation may use any component structure, but it must expose the
following observable behaviour to users and Playwright tests.

### Labels and controls

1. The staff page is **Slots & tables**.
2. The week line provides a clearly named **Copy this week** control to open the
   copy flow.
3. The dialog exposes the sections **Source period** and
   **Continuation periods**.
4. Continuation periods are selected one at a time with checkboxes. A period
   with bookings cannot be ticked.
5. The main actions are **Copy to N periods** and **Cancel**. While saving, the
   main action is disabled and reads **Copying…**.
6. The selected periods are identifiable by their complete date ranges, not by
   an ambiguous week number alone.
7. Tests locate controls by accessible roles, labels, and stable user-facing
   text, not CSS classes or element positions.

### Confirmation and saving

1. Before saving, the flow identifies the selected source period and every
   ticked continuation period.
2. If a ticked period has slots, the dialog shows a confirmation step. The
   confirmation offers **Go back** and **Replace and copy**.
3. If no ticked period has slots, the confirmation step is skipped and the
   operation is submitted directly.
4. If bookings prevent replacement, the server response is shown as a visible
   error.
5. While the operation is saving, the main action is disabled and reads
   **Copying…**.
6. A successful operation updates the visible destination schedule without a
   full page reload and shows a visible success message.
7. A refused or failed operation shows a visible error and does not show a
   partially changed destination schedule.

### Validation and formatting

1. The source and destination periods must be different.
2. A destination interval must contain complete seven-day periods aligned to
   the selected source date and must start after the source period.
3. Server-side validation remains authoritative for all copy rules.
4. Period ranges and slot dates use one consistent readable format. API dates use
   `YYYY-MM-DD`.
5. Slot times use 24-hour `HH:MM` format and are displayed as
   `HH:MM–HH:MM`.

## Shared constraints

1. Only an employee or the warden can repeat a weekly schedule.
2. A seven-day period starts on the selected date and ends six days later.
   Every source slot is copied to the corresponding relative day of each
   destination period.
3. A copied slot keeps its start time, end time, table-set assignment, table
   numbers, and capacities. A slot without a table set remains without one.
4. Existing table sets are reused; the operation does not create duplicate
   table sets.
5. Bookings are never copied from the source period.
6. Copying into empty destination periods creates the source period's slots.
7. Copying into destination periods that have slots but no active bookings
   completely replaces those periods' schedules. Destination-only slots are
   removed.
8. Copying into any destination period with one or more active bookings is
   refused. All destination schedules and active bookings remain unchanged.
   A destination containing only cancelled bookings can be replaced; those
   cancelled bookings are deleted with the old slots.
9. The source schedule is unchanged by every copy attempt.

## Scenario 1: An employee copies a schedule into an empty period

**Given**

1. An employee account exists with valid credentials, and the employee is
   logged in.
2. The source period starts on a selected non-Monday date and contains at least
   three slots, including two slots on one day, one slot with a table set, and
   one slot without a table set.
3. The destination is a different future seven-day period with no slots and no
   active bookings.
4. The source slot dates, times, table-set assignments, and seat totals are
   recorded.

**When**

1. The employee opens **Slots & tables**.
2. The employee selects **Copy this week**.
3. The employee ticks one empty continuation period.
4. The employee selects **Copy to 1 period** and waits for completion.

**Then**

1. The operation succeeds and the destination is updated without a full page
   reload.
2. The destination contains one corresponding slot for every source slot on
   the same relative day of the seven-day period.
3. Every copied slot has the recorded source time, table-set assignment, and
   seat total.
4. The slot without a table set remains without one and has `0` seats.
5. No booking is created in the destination.
6. The source schedule is unchanged.

## Scenario 2: An existing destination without active bookings is replaced

**Given**

1. An employee is logged in.
2. The source period contains a valid schedule.
3. The destination period contains at least one **Destination-only slot**, and
   no destination slot has an active booking.

**When**

1. The employee selects **Copy this week** and ticks the destination period.
2. The employee selects **Copy to 1 period**.
3. Because the ticked period has slots, the employee selects **Replace and
   copy** in the confirmation step.
4. The employee opens or reloads the destination period after the operation
   completes.

**Then**

1. The operation succeeds.
2. The destination contains exactly the source slots mapped to the destination
   dates.
3. **Destination-only slot** is no longer present.
4. No old destination slot remains in addition to a copied slot.
5. The source period is unchanged.

## Scenario 3: A destination with active bookings cannot be replaced

**Given**

1. An employee is logged in.
2. The source period contains a valid schedule.
3. A destination period contains at least two slots, and at least one of them
   has an active booking.
4. The destination slots, active booking, table assignments, and available seats
   are recorded.

**When**

1. The employee selects **Copy this week**.
2. The employee observes that the destination period is locked and its
   checkbox cannot be ticked.

**Then**

1. The locked period has a visible explanation that it has bookings and cannot
   be replaced.
2. The destination schedule is unchanged: no slot is deleted, added, or
   modified.
3. The destination booking, table assignments, and available seats are
   unchanged.
4. The source schedule is unchanged.
5. No partial copy is visible, and the employee can choose another destination.

## Scenario 4: The same source can be repeated into contiguous and separate periods

**Given**

1. An employee is logged in.
2. One source period contains a valid schedule.
3. Two contiguous future destination periods and one later non-consecutive
   destination period are empty and have no active bookings.

**When**

1. The employee ticks the two contiguous periods and the later,
   non-consecutive period one by one.
2. The employee selects **Copy to 3 periods** and, because the selected periods
   are empty, waits for the operation to complete without a confirmation step.

**Then**

1. The operation succeeds and updates all selected intervals.
2. All three destination periods contain the same schedule pattern and slot
   details, mapped to their own dates.
3. A contiguous interval and a separate non-consecutive interval are both
   accepted; the copy operation does not link their future changes to the source
   or to each other. Later slot adjustments are covered by MH-19.

## Scenario 5: Invalid selections are rejected

Run these variants independently:

1. The source and destination are the same period.
2. A destination interval is not a complete seven-day period aligned to the
   selected source date.

**Given**

1. An employee is logged in.
2. The selected periods match the variant above.

**When**

1. The employee opens the **Copy this week** flow.
2. The employee makes the invalid selection and attempts to continue or selects
   the main copy action.

**Then**

1. The operation is rejected with a visible explanation.
2. No copy request is sent when the invalidity is detectable before submission.
3. If a request reaches the server, neither period is changed.

## Scenario 6: An empty source cannot be copied

**Given**

1. An employee is logged in.
2. The selected source period contains no slots.

**When**

1. The employee selects **Copy this week**.

**Then**

1. The dialog identifies that there is nothing to copy and the main copy action
   is disabled or no copy request can be submitted.
2. No destination period is changed.

## Scenario 7: A destination with only cancelled bookings can be replaced

**Given**

1. An employee is logged in.
2. The source period contains a valid schedule.
3. A destination period has slots with cancelled bookings only and no active
   bookings.
4. The cancelled booking records and destination slots are recorded for the
   persistence check.

**When**

1. The employee selects **Copy this week** and ticks the destination period.
2. The employee selects **Copy to 1 period**.
3. Because the destination has slots, the employee selects **Replace and copy**.

**Then**

1. The operation succeeds.
2. The destination is replaced with the copied source schedule.
3. The cancelled bookings belonging to the replaced destination slots are
   deleted, including their dependent booking details.
4. No booking is copied from the source.

## Scenario 8: A booking arriving while the dialog is open is handled atomically

**Given**

1. An employee is logged in.
2. The source period contains a valid schedule.
3. A destination period is initially empty or has no active bookings.

**When**

1. The employee selects **Copy this week** and ticks the destination period.
2. Before the employee submits, another supported test actor creates an active
   booking in that destination period.
3. The employee selects the main copy action and, if shown, selects
   **Replace and copy**.

**Then**

1. The operation is rejected with a visible booking conflict.
2. The dialog refreshes the periods, locks the affected period, unticks it, and
   keeps any other valid ticks.
3. No selected destination period is partially changed.
4. The newly created booking and the source schedule remain unchanged.

## Scenario 9: Only staff can repeat a weekly schedule

**Given**

1. A hiker account exists and is logged in.
2. A visitor has no authenticated session.
3. A source schedule and empty destination periods exist.

**When**

1. The hiker opens **Slots & tables** and attempts to access **Copy this week**.
2. The visitor requests the staff schedule-copy operation.

**Then**

1. The hiker cannot access or submit the staff copy operation.
2. The visitor is rejected as unauthenticated or redirected to login.
3. Neither attempt changes the destination schedule.

## Test data and environment

1. Tests use isolated future periods, employee credentials, slots, table sets,
   and bookings. They do not depend on demo data.
2. Tests record the source and destination values before copying when verifying
   that a refused operation made no changes.
3. Booking fixtures are created through supported test setup and removed
   only as part of that scenario's cleanup.
4. Tests wait for visible loading, success, or error states and completed
   network responses; arbitrary fixed delays are not used.
5. Browser assertions cover the employee-visible result. API/database checks
   may verify booking and persistence details that the UI does not expose.

## Sources

- [MH-09 - Repeat a weekly schedule](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-09.md)
- [MH-02 E2E scenarios](MH-2-define-tables-and-slots-e2e-scenarios.md)
- [MH-19 - Modify a slot](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-19.md)
