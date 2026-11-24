# MH-9 - Repeat a weekly schedule

These end-to-end scenarios cover the employee's weekly schedule copy flow. They
use Given/When/Then form so that they can be translated directly into Playwright
tests.

The operation copies the meal slots of one Monday-to-Sunday calendar week into
another Monday-to-Sunday week. It does not copy reservations or create
duplicate table sets. A destination week
with reservations cannot be replaced; a destination week with slots but no
reservations is completely replaced by the copied schedule.

## Frontend contract for E2E testability

The implementation may use any component structure, but it must expose the
following observable behaviour to users and Playwright tests.

### Labels and controls

1. The staff page is **Slots & tables**.
2. The page provides one clearly named control, **Repeat weekly schedule**, to
   open the copy flow.
3. The flow has accessible controls labelled **Source week** and
   **Destination week**.
4. The flow has **Repeat schedule** and **Cancel** actions.
5. The selected weeks are identifiable by their complete date ranges, not by an
   ambiguous week number alone.
6. Tests locate controls by accessible roles, labels, and stable user-facing
   text, not CSS classes or element positions.

### Confirmation and saving

1. Before saving, the flow identifies the selected source and destination weeks.
2. If the destination already has slots, the flow makes clear that the
   destination schedule will be replaced. If reservations prevent the
   replacement, the server response is shown as a visible error.
3. While the operation is saving, **Repeat schedule** is disabled and shows a
   visible pending state such as **Repeating…**.
4. A successful operation updates the visible destination schedule without a
   full page reload and shows a visible success message.
5. A refused or failed operation shows a visible error and does not show a
   partially changed destination schedule.

### Validation and formatting

1. The source and destination must be different weeks.
2. Server-side validation remains authoritative for all copy rules.
3. Week ranges and slot dates use one consistent readable format. API dates use
   `YYYY-MM-DD`.
4. Slot times use 24-hour `HH:MM` format and are displayed as
   `HH:MM–HH:MM`.

## Shared constraints

1. Only an employee or the warden can repeat a weekly schedule.
2. A week is Monday through Sunday. Every source slot is copied to the
   corresponding weekday of the destination week.
3. A copied slot keeps its start time, end time, table-set assignment, table
   numbers, and capacities. A slot without a table set remains without one.
4. Existing table sets are reused; the operation does not create duplicate
   table sets.
5. Reservations/bookings are never copied from the source week.
6. Copying into an empty destination creates the source week's slots.
7. Copying into a destination that has slots but no reservations completely
   replaces that destination schedule. Destination-only slots are removed.
8. Copying into a destination with one or more reservations is refused. The
   destination schedule and its reservations remain unchanged.
9. The source schedule is unchanged by every copy attempt.

## Scenario 1: An employee copies a schedule into an empty week

**Given**

1. An employee account exists with valid credentials, and the employee is
   logged in.
2. The source week contains at least three slots, including two slots on one
   day, one slot with a table set, and one slot without a table set.
3. The destination is a different future week with no slots and no reservations.
4. The source slot dates, times, table-set assignments, and seat totals are
   recorded.

**When**

1. The employee opens **Slots & tables**.
2. The employee selects **Repeat weekly schedule**.
3. The employee chooses the source week and destination week.
4. The employee selects **Repeat schedule** and waits for completion.

**Then**

1. The operation succeeds and the destination is updated without a full page
   reload.
2. The destination contains one corresponding slot for every source slot on the
   same weekday.
3. Every copied slot has the recorded source time, table-set assignment, and
   seat total.
4. The slot without a table set remains without one and has `0` seats.
5. No reservation is created in the destination.
6. The source schedule is unchanged.

## Scenario 2: An existing destination without reservations is replaced

**Given**

1. An employee is logged in.
2. The source week contains a valid schedule.
3. The destination week contains at least one **Destination-only slot**, and no
   destination slot has a reservation.

**When**

1. The employee copies the source week into the destination week.
2. The employee opens or reloads the destination week after the operation
   completes.

**Then**

1. The operation succeeds.
2. The destination contains exactly the source slots mapped to the destination
   dates.
3. **Destination-only slot** is no longer present.
4. No old destination slot remains in addition to a copied slot.
5. The source week is unchanged.

## Scenario 3: A destination with reservations cannot be replaced

**Given**

1. An employee is logged in.
2. The source week contains a valid schedule.
3. The destination week contains at least two slots, and at least one of them
   has an existing reservation.
4. The destination slots, reservation, table assignments, and available seats
   are recorded.

**When**

1. The employee selects the source and destination weeks.
2. The employee attempts to select **Repeat schedule**.
3. If the UI allows submission before checking the destination, the employee
   confirms and waits for the response.

**Then**

1. The operation is refused with a visible explanation that the destination
   cannot be replaced because it has reservations.
2. The destination schedule is unchanged: no slot is deleted, added, or
   modified.
3. The destination reservation, table assignments, and available seats are
   unchanged.
4. The source schedule is unchanged.
5. No partial copy is visible, and the employee can choose another destination.

## Scenario 4: The same source can be repeated into more than one week

**Given**

1. An employee is logged in.
2. One source week contains a valid schedule.
3. Two different future destination weeks are empty and have no reservations.

**When**

1. The employee repeats the source week into the first destination week.
2. After the first operation completes, the employee repeats the same source
   week into the second destination week.

**Then**

1. Both operations succeed independently.
2. Both destination weeks contain the same schedule pattern and slot details,
   mapped to their own dates.
3. The two destination schedules are independent records; the copy operation
   does not link their future changes to the source or to each other. Later slot
   adjustments are covered by MH-19.

## Scenario 5: Invalid selections are rejected

Run these variants independently:

1. The source and destination are the same week.

**Given**

1. An employee is logged in.
2. The selected weeks match the variant above.

**When**

1. The employee opens the repeat flow.
2. The employee makes the invalid selection and attempts to continue or selects
   **Repeat schedule**.

**Then**

1. The operation is rejected with a visible explanation.
2. No copy request is sent when the invalidity is detectable before submission.
3. If a request reaches the server, neither week is changed.

## Scenario 6: Only staff can repeat a weekly schedule

**Given**

1. A hiker account exists and is logged in.
2. A visitor has no authenticated session.
3. A source schedule and an empty destination week exist.

**When**

1. The hiker opens **Slots & tables** and attempts to access the repeat flow.
2. The visitor requests the staff schedule-copy operation.

**Then**

1. The hiker cannot access or submit the staff copy operation.
2. The visitor is rejected as unauthenticated or redirected to login.
3. Neither attempt changes the destination schedule.

## Test data and environment

1. Tests use isolated future weeks, employee credentials, slots, table sets,
   and reservations. They do not depend on demo data.
2. Tests record the source and destination values before copying when verifying
   that a refused operation made no changes.
3. Reservation fixtures are created through supported test setup and removed
   only as part of that scenario's cleanup.
4. Tests wait for visible loading, success, or error states and completed
   network responses; arbitrary fixed delays are not used.
5. Browser assertions cover the employee-visible result. API/database checks
   may verify reservation and persistence details that the UI does not expose.

## Sources

- [MH-09 - Repeat a weekly schedule](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-09.md)
- [MH-02 E2E scenarios](MH-2-define-tables-and-slots-e2e-scenarios.md)
- [MH-19 - Modify a slot](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-19.md)
