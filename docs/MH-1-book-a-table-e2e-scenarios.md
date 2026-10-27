# MH-1 - Book a table

These end-to-end scenarios cover the booking flow for a hiker. They are written in
Given/When/Then form so that they can be translated directly into browser tests.

## Shared constraints

1. The booking request contains a positive integer `slotId` and a positive integer
   `partySize`. Invalid or missing values are rejected with `400 Bad Request`.
2. This document covers the hiker self-service booking flow. A logged-in hiker
   may use it; employees may also create bookings on behalf of hikers through a
   separate staff-assisted workflow. The staff workflow is outside MH-1 and must
   not be inferred from these scenarios.
3. The server is authoritative for booking rules. The client must not bypass the
   checks by changing the displayed availability or request payload.
4. The server checks whether the party fits according to the hut's seating rule,
   not only according to a client-side seat counter.
5. A booking conflict, such as a slot being full or closed, is returned as
   `409 Conflict`. An unknown slot is returned as `404 Not Found`.
6. A successful booking is committed before the confirmation email is sent. A
   mail-delivery failure must not cancel or undo the booking.

## Scenario 1: A hiker books a table successfully

**Given**

1. A hiker account exists with a valid email and password.
2. The hiker is logged in.
3. A meal slot is available for booking and starts more than two hours from now.
4. The slot has enough free seats for a party of two.

**When**

1. The hiker opens the table availability page.
2. The hiker selects the available meal slot.
3. The hiker enters a party size of `2`.
4. The hiker submits the booking.

**Then**

1. The booking request is accepted with `201 Created`.
2. A booking confirmation is shown to the hiker, including the selected meal slot
   and party size.
3. The booking appears in the hiker's bookings.
4. The slot's remaining free seats are reduced by two.
5. A confirmation email is requested for the booking.

## Scenario 2: A party bigger than the free seats is refused

**Given**

1. A hiker account exists and the hiker is logged in.
2. An available meal slot has `2` free seats.
3. The slot starts more than two hours from now.

**When**

1. The hiker opens the table availability page.
2. The hiker selects the meal slot with `2` free seats.
3. The hiker enters a party size of `3`.
4. The hiker submits the booking.

**Then**

1. The booking is refused with `409 Conflict`.
2. A clear error explains that the slot does not have enough free seats.
3. No booking is added to the hiker's bookings.
4. The slot's free-seat count is unchanged.
5. No confirmation email is requested.

## Scenario 3: A booking less than two hours before the meal is refused

**Given**

1. A hiker account exists with valid credentials, and the hiker is logged in
   with an active, unexpired session.
2. A meal slot exists and is visible in the availability page.
3. The meal slot starts in less than two hours but has not started yet.
4. The slot has enough free seats, and the party of two would fit according to
   the hut's seating rule.
5. The slot is not already booked by this hiker, and no other test data changes
   the slot between displaying it and submitting the request.
6. The test clock is fixed or controlled so that the slot is unambiguously less
   than two hours away at submission time.

**When**

1. The hiker opens the table availability page.
2. The hiker selects the meal slot.
3. The hiker enters a party size of `2`.
4. The hiker submits the booking.

**Then**

1. The booking is refused with `409 Conflict` because the booking window is closed.
2. A clear error explains that bookings close two hours before the meal.
3. No booking is added to the hiker's bookings.
4. The slot's free-seat count is unchanged.
5. No confirmation email is requested.

> Boundary condition: a booking submitted exactly two hours before the meal is
> still open; only a booking submitted with less than two hours remaining is
> refused.

## Scenario 4: A user who is not logged in is sent to the login page

**Given**

1. The browser has no active session: there is no valid `sid` cookie and no
   authenticated client state.
2. The booking data is otherwise valid: the meal slot exists, is visible, starts
   more than two hours from now, and has enough seats for a party of two.
3. The slot is not already booked by the test user, and the test data is stable
   while the booking attempt is made.
4. Valid hiker credentials are available for the login step after the redirect.

**When**

1. The user opens the table availability page.
2. The user selects the available meal slot.
3. The user enters a party size of `2`.
4. The user attempts to submit the booking with the positive integer party size
   `2`.

**Then**

1. The booking is not created.
2. The booking API responds with `401 Unauthorized`.
3. The web client redirects the user to the login page.
4. The login form is displayed.
5. The login page preserves the intended booking destination, or otherwise
   provides a way to return to the booking flow.
6. After logging in successfully, the user can submit the booking.

