# MH-1 - Book a table

These end-to-end scenarios cover the hiker's booking flow shown in the MH-39
booking mockup. They use Given/When/Then form so they can be translated directly
into Playwright tests.

## Shared constraints

1. The booking page is called **Book a table**.
2. A booking requires a day, a party size, and a time.
3. The day and time must come from the available choices shown by the system.
4. The party size is a positive integer. The server remains authoritative even
   though the browser disables choices that are known to be invalid.
5. A party may be split across tables when necessary; it is still one booking.
6. Exactly two hours before a slot starts is still within the booking window.

## Scenario 1: A hiker books a table successfully

**Given**

1. A hiker account exists with valid credentials, and the hiker is logged in.
2. The **Book a table** page has an available day with at least one available
   time.
3. The selected time starts more than two hours from the controlled current time.
4. The selected time can fit a party of two according to the hut's seating rule.

**When**

1. The hiker opens **Book a table**.
2. The hiker chooses the available day.
3. The hiker sets the number of people to `2`.
4. The hiker chooses the available time.
5. The hiker selects **Review booking**.
6. The review shows the selected day, time, party size, and the tables chosen by
   the system.
7. The hiker selects **Confirm booking**.

**Then**

1. The booking is saved successfully with `201 Created`.
2. A confirmation page is displayed with the text **Table booked**.
3. The confirmation shows the selected day, time, party size, and table
   allocation.

## Scenario 2: A party bigger than the free seats cannot select the time

**Given**

1. A hiker account exists, and the hiker is logged in.
2. The selected day contains a visible time with exactly `2` free seats.
3. The hiker chooses a party size of `3`.
4. The time is not closed for booking.

**When**

1. The hiker opens **Book a table**.
2. The hiker chooses the day.
3. The hiker sets the number of people to `3`.
4. The hiker views the available times for that day.

**Then**

1. The time remains visible but cannot be selected.
2. The time explains the reason with text such as **Only 2 seats free**.
3. The hiker cannot choose that time.
4. **Review booking** remains disabled because no valid time is selected.
5. No booking request is submitted.

## Scenario 3: A time less than two hours before the meal cannot be selected

**Given**

1. A hiker account exists with valid credentials, and the hiker is logged in
   with an active, unexpired session.
2. The selected day contains a visible time that has not started yet.
3. The time starts less than two hours from the controlled current time.
4. The time has enough free seats for a party of two, so capacity is not the
   reason it is unavailable.
5. The test clock is fixed or controlled so the time is unambiguously less than
   two hours away while the page is tested.

**When**

1. The hiker opens **Book a table**.
2. The hiker chooses the day.
3. The hiker sets the number of people to `2`.
4. The hiker views the available times for that day.

**Then**

1. The time remains visible but cannot be selected.
2. The time explains the reason with text such as **Closed at HH:MM**.
3. The hiker cannot choose that time.
4. **Review booking** remains disabled because no valid time is selected.
5. No booking request is submitted.

> Boundary condition: a time starting exactly two hours from the controlled
> current time remains selectable.

## Scenario 4: A user who is not logged in is sent to the login page

**Given**

1. The browser has no active session: there is no valid `sid` cookie and no
   authenticated client state.
2. Valid hiker credentials are available for the login step.

**When**

1. The user opens **Book a table**.

**Then**

1. The user is redirected to the login page immediately, before choosing a day,
   party size, or time.
2. The login page displays the note **Log in to book a table.**
3. After the user logs in successfully, the user is returned to **Book a table**.
4. The user can then start the booking flow by choosing a day.
