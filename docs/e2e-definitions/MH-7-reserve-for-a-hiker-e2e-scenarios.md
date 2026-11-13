# MH-7 - Enter a reservation for a hiker

**Business value:** 955

> As an employee, I want to enter a reservation for a hiker so that I can
> accept reservations through channels other than the web.

These end-to-end scenarios cover the employee's flow for entering a reservation
for another hiker, so reservations can be accepted by phone, message or at the
hut. They follow the MH-07 story and the [reservation-for-a-hiker
mockup](../mockups/reservation-for-a-hiker/README.md), and use Given/When/Then
form so they can be translated directly into Playwright tests.

The flow is on **Reservations**. It lets staff find an existing regular hiker,
create a temporary hiker with a quick entry, or create a regular hiker account
with a full profile, and then save a reservation for that hiker.

## Frontend contract for E2E testability

The frontend implementation may use any component structure, but it must expose
the following observable behaviour to users and Playwright tests.

### Labels and accessible controls

1. The page title or main heading is **Reservations**.
2. The hiker search has the accessible name **Find the hiker** and the
   placeholder **Name, phone or email**.
3. The page exposes stable, user-facing controls named:
   - **+ New hiker**
   - **Quick entry**
   - **Full profile**
   - **Add hiker**
   - **Change**
   - **Save reservation**
   - **+ New reservation**
   - **Done**
4. Reservation fields have accessible names for **Day**, **People**, and the
   available time choices.
5. Hiker results expose the hiker's name, email and phone as readable text.
6. Tests use accessible roles, labels and stable user-facing text rather than
   CSS classes or element positions.

### Asynchronous operations

1. Searching starts only after the user has entered at least two characters.
2. While a search, hiker creation or reservation is pending, the relevant
   control is disabled and a visible pending state is shown.
3. A successful hiker creation selects the new hiker without a page reload.
4. A successful reservation shows **Reservation saved** and the saved details.
5. A failed request leaves the hiker, day, people and time choices in a state
   that the employee can correct and retry.

### Test data and time

1. Each test uses unique names and email addresses for newly created hikers.
2. Tests use a dedicated E2E database and do not depend on data created by
   another test.
3. Tests use future dates and controlled time, or a test clock, for all
   time-sensitive scenarios.
4. The test environment sends mail through Mailpit; no real mailbox is used.
5. Mailpit messages are filtered by unique recipient and cleared or recorded
   before each scenario.

## Shared constraints

1. The employee can use the reservation-for-a-hiker flow. Visitor and hiker
   access is denied; the warden is outside this story's scope unless the team
   explicitly includes that role.
2. The hiker can be an existing regular account, a newly created regular
   account, or a temporary hiker.
3. Search results contain only regular hiker accounts: temporary hikers,
   employees and other staff accounts are not listed.
4. The search matches a regular hiker's name, phone or email and starts at two
   characters. At most 20 results are shown.
5. A temporary hiker has a name and optional phone, no email and no password;
   they cannot log in or book through the public hiker flow.
6. A full profile has a name, email and optional phone. It creates a regular
   hiker account and generates a password that is communicated to the hiker.
   The E2E environment uses the account email for this handoff; the employee
   does not enter a password in the form.
7. The staff time limit is the start of the slot. A slot is bookable before its
   start, including less than two hours before it; it is not bookable at or
   after its start. The hiker's two-hour rule does not apply.
8. The party must fit in the free seats. The system chooses the tables and may
   split the party over several tables, as in MH-01.
9. A hiker can have at most one active reservation for a slot.
10. A regular hiker receives the normal booking confirmation email after a
    successful staff reservation. A temporary hiker receives no email.
11. Until a hiker is selected, the day, people and time controls are locked and
    **Save reservation** is disabled.

The story's 24-hour reset-link requirement is consistent with section 3.8 of
[NIST SP 800-63A-4](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-63A-4.pdf):
confirmation codes sent to a validated email address are valid for at most 24
hours and are invalidated after use. The password-reset scenarios below apply
the same product rule to the reset link.

## Scenario 1: A staff member opens the reservation flow

**Given**

1. An employee account exists with valid credentials.
2. The employee is logged in.
3. A visitor has no authenticated session.
4. A hiker account exists with valid credentials.

**When**

1. The employee opens **Reservations**.
2. The visitor requests the reservations page.
3. The hiker requests the reservations page.

**Then**

1. The employee sees the reservation-for-a-hiker flow.
2. The visitor is sent to login or receives an unauthenticated response.
3. The hiker cannot use the staff flow and receives the staff-only response.
4. No hiker, slot or reservation is created by the denied requests.

## Scenario 2: Staff searches for and selects an existing regular hiker

**Given**

1. An employee is logged in.
2. A regular hiker exists with a unique name, email and phone.
3. A temporary hiker has a similar name.
4. A staff account has a matching name or email fragment.

**When**

1. The employee opens **Reservations**.
2. The employee types one character in **Find the hiker**.
3. The employee types at least two characters matching the regular hiker's
   name, phone or email.
4. The employee selects the regular hiker from the results.

**Then**

1. No search request is sent for the one-character input.
2. The matching regular hiker is shown with name, email and phone.
3. The temporary hiker, employee and warden are not shown.
4. The selected hiker is shown in the chosen-hiker card.
5. **Change** returns the employee to the search without creating a hiker.
6. The day, people and time controls become available only after a hiker is
   selected.

## Scenario 3: Quick entry creates a temporary hiker

**Given**

1. An employee is logged in.
2. The employee has opened **New hiker**.

**When**

1. The employee selects **Quick entry**.
2. The employee enters a first name and last name.
3. The employee enters an optional valid phone number.
4. The employee selects **Add hiker**.

**Then**

1. The temporary hiker is created successfully.
2. The dialog closes and the new temporary hiker is selected.
3. The selected hiker shows no email and is identified as temporary or having no
   login.
4. No account password email is sent.
5. The day, people and time controls become available.

## Scenario 4: Full profile creates a regular hiker account

**Given**

1. An employee is logged in.
2. The employee has opened **New hiker**.
3. The full-profile email address is unique.
4. Mailpit contains no previous message for that address.

**When**

1. The employee selects **Full profile**.
2. The employee enters a first name, last name, unique email and optional
   phone.
3. The employee selects **Add hiker**.
4. The test waits for the account email in Mailpit.

**Then**

1. The regular hiker account is created successfully.
2. The dialog closes and the new hiker is selected.
3. The form has no password field; the generated password is communicated to
   the hiker through the configured handoff channel.
4. Exactly one account email is sent to the new hiker.
5. In the E2E environment, the account email contains the hiker's name, email,
   generated password and the instruction to change the password at first
   login.
6. The email contains a login link and a fallback **Forgot password?**
   instruction.
7. The account remains available even if the employee does not save a
   reservation afterwards.

## Scenario 5: Staff saves a reservation for an existing regular hiker

**Given**

1. An employee is logged in.
2. An existing regular hiker is selected.
3. The chosen day has a slot before its start with enough free seats for a
   party of two.
4. The selected slot has a deterministic table allocation.
5. Mailpit contains no previous confirmation for the hiker's email address.

**When**

1. The employee selects the day.
2. The employee sets **People** to `2`.
3. The employee selects the available time.
4. The employee selects **Save reservation**.
5. The test waits for a new message addressed to the selected hiker.

**Then**

1. The reservation is saved successfully with `201 Created`.
2. **Reservation saved** is displayed.
3. The confirmation shows the hiker, day, time, party size and tables chosen by
   the system.
4. Exactly one booking confirmation email is received by the regular hiker.
5. The email contains the booking reference, hiker name, date, time and party
   size recorded from the saved reservation.
6. **Done** finishes the flow, while **+ New reservation** starts with no
   previous hiker or reservation selected.

## Scenario 6: Staff saves a reservation for a temporary hiker

**Given**

1. An employee is logged in.
2. A temporary hiker has been created through **Quick entry** and is selected.
3. The chosen day has a slot before its start with enough free seats for a
   party of three.
4. Mailpit contains no message for the temporary hiker, who has no email.

**When**

1. The employee chooses the day, `3` people and an available time.
2. The employee selects **Save reservation**.
3. The test checks Mailpit for any message generated by this reservation.

**Then**

1. The reservation is saved successfully.
2. **Reservation saved** shows the temporary hiker, party size and table
   allocation.
3. No email is sent, because the temporary hiker has no email address.
4. The temporary hiker cannot log in or make a public booking.

## Scenario 7: The staff time rule is different from the hiker rule

**Given**

1. An employee is logged in and has selected a hiker.
2. A slot has enough free seats and starts at a controlled time.
3. The test clock is controlled so the slot can be checked at its boundary.

**When**

1. The employee tries to reserve the slot less than two hours before its start,
   but before it starts.
2. The employee saves the reservation.
3. In a separate run, the employee tries to reserve the same slot at its exact
   start time.
4. In another run, the employee tries after the start time.

**Then**

1. The reservation before the start succeeds even though it is inside the
   hiker's two-hour window.
2. At the exact start time, the time is unavailable and the reservation is not
   saved.
3. After the start time, the time is unavailable and the reservation is not
   saved.
4. The employee sees **Started at HH:MM** or the documented equivalent.

## Scenario 8: A party that does not fit cannot be reserved

**Given**

1. An employee is logged in and has selected a hiker.
2. The chosen slot has fewer free seats than the requested party size.
3. The selected slot has not started.

**When**

1. The employee chooses the day.
2. The employee sets a party size larger than the free seats.
3. The employee views the time choices.

**Then**

1. The time remains visible but cannot be selected because it cannot fit the
   requested party.
2. The UI explains the available seats and requested party size.
3. **Save reservation** remains disabled when no valid time is selected.
4. No reservation or confirmation email is created.

## Scenario 9: A duplicate reservation is rejected without losing the choices

**Given**

1. An employee is logged in.
2. A hiker already has an active reservation for the selected slot.
3. The employee has selected that hiker, day, people and slot again.

**When**

1. The employee selects **Save reservation**.

**Then**

1. The request is rejected with `422 Unprocessable Entity`.
2. The page shows that the hiker already has a booking at the selected time.
3. No second reservation is created.
4. The selected hiker, day, people and time remain available so the employee
   can choose another time.
5. No confirmation email is sent for the rejected request.

## Scenario 10: Email conflicts are handled without exposing staff accounts

**Given**

1. An employee is logged in.
2. A regular hiker already owns email address A.
3. A staff account owns email address B.

**When**

1. The employee opens **New hiker** with **Full profile**.
2. The employee enters email address A and submits **Add hiker**.
3. The employee repeats the operation with email address B.

**Then**

1. For email A, creation is rejected with the documented `409` response.
2. The page searches for the existing hiker and offers to choose that hiker.
3. Choosing the existing hiker closes the dialog and selects them for the
   reservation.
4. For email B, the page says the email is already in use and asks for another
   email.
5. The staff account's name is not revealed as a hiker search result.
6. No duplicate account is created in either case.

## Scenario 11: The slot can start between choosing and saving

**Given**

1. An employee is logged in and has selected a hiker.
2. A slot is available before its start and has enough seats.
3. The employee has selected the slot and opened the reservation summary.
4. The controlled clock is just before the slot start.

**When**

1. The test advances the clock past the slot start before the employee selects
   **Save reservation**.
2. The employee selects **Save reservation**.

**Then**

1. The request is rejected with `422 Unprocessable Entity`.
2. The page says **This time has already started. Choose another time.**
3. No reservation is created.
4. The hiker, day and people choices are kept.
5. The times are refreshed; the started slot is no longer selected and shows
   **Started at HH:MM**.

## Scenario 12: A newly created regular hiker can log in and change the password

**Given**

1. A staff member has created a regular hiker through **Full profile**.
2. The hiker account email has arrived in Mailpit.
3. The test has extracted the generated password from the email.

**When**

1. The hiker opens the login page.
2. The hiker logs in with the emailed password.
3. The hiker tries to open a protected booking page.
4. The hiker enters a new password and confirms the change.
5. The hiker opens the protected booking page again.

**Then**

1. Login succeeds and the hiker is marked as required to change the password.
2. Protected booking actions are blocked before the password change.
3. The password-change operation succeeds.
4. The hiker can use protected pages after choosing the new password.
5. The generated password is not entered or edited by the employee in the
   reservation flow.

## Scenario 13: A hiker can recover a newly created account by email

**Given**

1. A regular hiker account created by staff exists with a unique email.
2. The hiker can open the login page.
3. Mailpit contains no previous reset message for the hiker.

**When**

1. The hiker selects **Forgot password?**.
2. The hiker enters the account email and requests a reset link.
3. The test waits for the reset email in Mailpit.
4. The hiker opens the reset link and chooses a new password.
5. The hiker logs in with the new password.

**Then**

1. The reset email is addressed to the hiker and contains a link to **Choose a
   new password**.
2. The email says that the link works for 24 hours and only once.
3. The new password is accepted when the link is used within 24 hours and
   login succeeds.
4. Reusing the same reset link is rejected.

## Scenario 14: An expired password-reset link is rejected

**Given**

1. A regular hiker account exists with a unique email.
2. The hiker has requested a password reset and received the reset email.
3. The test clock is controlled.

**When**

1. The test advances the clock to just before 24 hours after the reset link was
   issued and verifies that the link still works.
2. The test requests another reset link, then advances the clock to 24 hours
   after that link was issued.
3. The hiker opens the expired link and submits a new password.

**Then**

1. The link works just before the 24-hour limit.
2. The link is rejected at or after the 24-hour limit.
3. The page says **This link no longer works** or the documented equivalent.
4. The old password remains unchanged after the expired-link attempt.
5. A new reset request can issue a new working link.

## Scenario 15: A rejected seat allocation does not create a reservation

**Given**

1. An employee is logged in and has selected a hiker.
2. The employee has selected a slot and opened the reservation summary.
3. Another booking consumes the seats or changes the available table
   allocation before the employee saves.

**When**

1. The employee selects **Save reservation**.

**Then**

1. The request is rejected with the documented `409` response, either
   `NO_SEATS` or `TABLES_CHANGED`.
2. No reservation is created for the selected hiker.
3. The available times and seating choices are refreshed.
4. The employee can choose another time or party size.
5. No confirmation email is sent for the rejected request.

## Scenario 16: Invalid hiker details are rejected before creation

**Given**

1. An employee is logged in.
2. The employee has opened **New hiker**.

**When**

1. In **Quick entry**, the employee submits an empty first name or last name.
2. The employee enters an invalid phone number.
3. In **Full profile**, the employee submits an invalid or empty email.
4. The employee enters another invalid phone number.

**Then**

1. The relevant field shows its validation message, such as **Enter the first
   name**, **Enter the last name**, **Enter a valid email**, or **Enter a valid
   phone number**.
2. **Add hiker** does not create an account while the form is invalid.
3. The dialog stays open and valid field values are preserved.
4. No account email or reservation is created.

## Scenario 17: A full-profile hiker receives both MH-07 emails

**Given**

1. An employee is logged in.
2. The employee is creating a new hiker with a unique full profile.
3. The chosen future slot has enough seats for a party of two.
4. Mailpit contains no previous messages for the new hiker's email address.

**When**

1. The employee selects **Full profile** and chooses **Add hiker**.
2. The test waits for the account email.
3. The employee chooses the day, sets **People** to `2`, selects an available
   time and chooses **Save reservation**.
4. The test waits for the booking confirmation email.

**Then**

1. The account email is sent when the hiker is created, before the reservation
   is saved.
2. The reservation is saved successfully.
3. A separate booking confirmation email is sent after the reservation is saved.
4. Exactly two messages are received for the hiker: one account email and one
   booking confirmation.
5. The account email contains the generated password; the confirmation email
   contains the booking reference and reservation details.

