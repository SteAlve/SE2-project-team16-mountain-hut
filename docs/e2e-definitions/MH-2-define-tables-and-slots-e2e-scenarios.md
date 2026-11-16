# MH-2 - Define tables and seats for time slots

These end-to-end scenarios cover the employee's table and meal-slot setup flow.
They use Given/When/Then form so that they can be translated directly into
Playwright tests.

The intended staff page is **Slots & tables**. The current client page is still
a placeholder, so these scenarios define the behaviour that the staff UI and
the corresponding API must expose.

## Frontend contract for E2E testability

The frontend implementation may use any component structure, but it must expose
the following observable behaviour to users and Playwright tests.

### Labels and accessible controls

1. Every form field has a visible label and an accessible name.
2. Buttons use stable, user-facing names:
   - **Create table set**
   - **Add table**
   - **Remove table**
   - **Save table set**
   - **Create slot**
   - **Assign table set**
3. Table-set and slot lists expose meaningful headings and row content.
4. Interactive controls use semantic HTML elements and accessible roles.
5. The UI must not rely on CSS classes or element positions as the only way to
   identify controls.

### Asynchronous operations

1. While a table set or slot is being saved, the save button is disabled.
2. The UI shows a visible pending state, such as **Saving…** or **Creating…**.
3. The pending state ends only after the server response is received.
4. A successful response updates the visible list without requiring a full page
   reload.
5. Errors from the server are displayed to the user and do not silently
   disappear.
6. A failed request must not leave the UI showing data that was not saved.

### Validation

1. Invalid values are rejected before submission when possible.
2. Server-side validation remains authoritative.
3. Validation messages identify the field that must be corrected.
4. Duplicate table numbers, non-positive capacities, empty names, invalid dates,
   and invalid time ranges are clearly reported.
5. An invalid submission must not create a table set or slot.

### Slot and table-set display

1. A slot displays its date, start time, end time, assigned table-set name, and
   total seats.
2. A slot without a table set visibly shows that it has no assigned tables and
   zero available seats.
3. A table set displays every table number, its capacity, and the total
   capacity.
4. Reusing a table set displays the same table numbers and capacities without
   requiring the employee to enter them again.
5. Different slots may display different table sets.

### Test data and time

1. Tests can create unique table-set names and future slot dates.
2. Tests do not depend on pre-existing demo data except for staff credentials.
3. Time-sensitive behaviour uses controlled or deterministic test data.
4. The UI does not require arbitrary fixed delays; tests can wait for visible
   loading or completion states.

### Formatting contract

1. API dates use ISO format: `YYYY-MM-DD`.
2. API and form times use 24-hour `HH:MM` format. Seconds are not displayed to
   users unless they are required by a specific rule.
3. A time range is displayed consistently as `HH:MM–HH:MM`, using an en dash
   between the start and end times.
4. Dates use a readable format in the UI, for example **Wednesday 4 November
   2026**. The same date must not be shown in multiple conflicting formats on
   the same screen.
5. Labels and button names use consistent capitalization and wording across
   the page.
6. Pending states use consistent text such as **Saving…**, **Creating…**, or
   **Loading…** and use the ellipsis character consistently.
7. Validation and server-error messages are visible, concise, and stable enough
   for an E2E test to identify the relevant problem.
8. Tests should prefer accessible roles, labels, and stable semantic text over
   CSS classes or incidental whitespace.
9. If localization is introduced, tests must select an explicit locale or use
   stable accessible labels that do not depend on translated visual text.

## Shared constraints

1. Only an employee or the warden can define table sets and meal slots.
2. A table set has a unique name and one or more tables.
3. Every table has a positive table number and a positive seat capacity.
4. A table set can be reused by more than one meal slot without being entered
   again.
5. Slot start time and duration are flexible.
6. More than one slot can exist on the same day, including adjacent slots such
   as `12:00–13:00` and `13:00–14:00`.
7. Different slots may use different table sets.
8. A slot without a table set has zero available seats and cannot accept
   bookings until a table set is assigned.

## Scenario 1: An employee creates a table set

**Given**

1. An employee account exists with valid credentials.
2. The employee is logged in.
3. No table set named **Lunch, main room** exists.

**When**

1. The employee opens **Slots & tables**.
2. The employee selects **Create table set**.
3. The employee enters the name **Lunch, main room**.
4. The employee adds table `1` with `4` seats.
5. The employee adds table `2` with `4` seats.
6. The employee adds table `3` with `6` seats.
7. The employee saves the table set.

**Then**

1. The table set is saved successfully with `201 Created`.
2. **Lunch, main room** appears in the list of table sets.
3. The tables are shown with numbers `1`, `2`, and `3`.
4. The total capacity is shown as `14` seats.

## Scenario 2: An employee creates a slot with a table set

**Given**

1. An employee is logged in.
2. The table set **Lunch, main room** exists.
3. The employee chooses a future date.

**When**

1. The employee selects **Create slot**.
2. The employee chooses the date.
3. The employee enters start time `12:00`.
4. The employee enters end time `13:30`.
5. The employee selects **Lunch, main room**.
6. The employee saves the slot.

**Then**

1. The slot is saved successfully with `201 Created`.
2. The slot appears on the selected date.
3. The slot shows `12:00–13:30`.
4. The slot shows the assigned table set and `14` total seats.

## Scenario 3: An employee creates more than one slot on the same day

**Given**

1. An employee is logged in.
2. The table set **Lunch, main room** exists.
3. The employee chooses a future date.

**When**

1. The employee creates a slot from `12:00` to `13:00` using **Lunch, main room**.
2. The employee creates another slot on the same date from `13:00` to `14:00`.
3. The employee uses the same table set for the second slot.

**Then**

1. Both slots are saved successfully.
2. Both slots appear on the same date in chronological order.
3. The two slots have the same table set and total capacity.
4. The employee did not have to re-enter the table numbers or capacities.

## Scenario 4: Different slots use different table sets

**Given**

1. An employee is logged in.
2. The table set **Lunch, main room** exists with `14` seats.
3. The table set **Dinner, terrace** exists with `20` seats.
4. Two slots exist on the same date.

**When**

1. The employee assigns **Lunch, main room** to the lunch slot.
2. The employee assigns **Dinner, terrace** to the dinner slot.

**Then**

1. The lunch slot shows the lunch table set and `14` seats.
2. The dinner slot shows the dinner table set and `20` seats.
3. Changing the table set for one slot does not change the other slot.

## Scenario 5: A slot without a table set has no bookable seats

**Given**

1. An employee is logged in.
2. The employee creates a future slot without selecting a table set.

**When**

1. The employee opens the list of slots.
2. The employee selects the slot without a table set.

**Then**

1. The slot is visible with no assigned table set.
2. The slot shows `0` total seats.
3. The slot cannot accept bookings.
4. The employee can assign an existing table set to the slot.
5. After assignment, the slot shows the table set and its total capacity.

## Scenario 6: Invalid table-set data is rejected

**Given**

1. An employee is logged in.

**When**

1. The employee tries to create a table set with no tables.
2. The employee tries to create a table with a non-positive capacity.
3. The employee tries to create two tables with the same table number.
4. The employee tries to create a table set with a name that already exists.

**Then**

1. Each invalid operation is rejected.
2. The UI explains which value must be corrected.
3. No invalid table set is created.
4. The existing table set remains unchanged.

## Scenario 7: Only staff can define tables and slots

**Given**

1. A hiker account exists and is logged in.
2. A visitor has no authenticated session.

**When**

1. The hiker opens **Slots & tables**.
2. The visitor requests the staff table-set or slot operation.

**Then**

1. The hiker cannot access the staff setup page or create table data.
2. The visitor is not authenticated to the staff operation.
3. No table set or slot is created.

