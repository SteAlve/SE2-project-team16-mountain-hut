# MH-3 - Receive booking confirmation

These end-to-end scenarios cover the booking confirmation email sent to a hiker
after a successful table booking. The email is delivered to Mailpit, which is
used as the email service in the E2E environment. They use Given/When/Then
form so they can be translated directly into Playwright tests.

## Shared constraints

1. The test environment sends email through Mailpit; no real external mailbox
   or email provider is used.
2. Every scenario uses a unique hiker email address, or removes/filter existing
   Mailpit messages for that address before starting, so messages from another
   test cannot satisfy the assertions.
3. The test waits by polling Mailpit for the message. A fixed sleep is not
   sufficient because sending the email is asynchronous.
4. The test records the booking reference, hiker name, selected date, time, and
   party size from the booking flow before checking the email. It must compare
   those values with the message instead of relying on hardcoded values.
5. The booking must be committed successfully before the confirmation email is
   expected. A failed or rejected booking must not be treated as successful
   merely because an old message exists in Mailpit.
6. The email content is checked semantically: insignificant whitespace and HTML
   markup may be normalized, but the booking reference, hiker name, date, time,
   and party size must be present and unambiguous.
7. The Mailpit UI or API may be used to inspect the message. The test must
   verify the recipient and message body, not only that Mailpit is reachable.

## Scenario 1: A successful booking sends a confirmation email

**Given**

1. Mailpit is running and configured as the application's SMTP server.
2. A hiker account exists with a unique email address and valid credentials.
3. The hiker is logged in.
4. The **Book a table** page has an available day and time for a party of two.
5. The selected time starts more than two hours from the controlled current
   time.
6. The selected time can accommodate the party, and the tables that will be
   allocated are available.
7. There is no previous confirmation message for the hiker's email address in
   Mailpit.

**When**

1. The hiker opens **Book a table**.
2. The hiker chooses the available day.
3. The hiker sets the number of people to `2`.
4. The hiker chooses the available time.
5. The hiker selects **Review booking**.
6. The test records the selected date, time, and party size shown in the
   review.
7. The hiker selects **Confirm booking**.
8. The test waits for a new message addressed to the hiker in Mailpit.
9. The test records the booking reference and hiker name from the booking
   confirmation details.

**Then**

1. The booking is saved successfully with `201 Created`.
2. The confirmation page is displayed with the text **Table booked**.
3. One booking confirmation email is received by the hiker's email address.
4. The message is available in Mailpit and can be opened or read through its
   API.

## Scenario 2: The confirmation email contains the booked details

**Given**

1. Mailpit is running and configured as the application's SMTP server.
2. A hiker account exists with a unique email address and valid credentials.
3. The hiker is logged in.
4. The **Book a table** page has an available day and time for a party of two.
5. The selected time starts more than two hours from the controlled current
   time and can accommodate the party.
6. There is no previous confirmation message for the hiker's email address in
   Mailpit.

**When**

1. The hiker completes the booking flow and records the booking reference, hiker
   name, selected date, time, and party size from the booking.
2. The test waits for the new confirmation message addressed to the hiker in
   Mailpit.
3. The test opens the message and reads its plain-text or rendered body.

**Then**

1. The recipient is the hiker's email address.
2. The message contains the booked date.
3. The message contains the booked start time.
4. The message contains the party size, `2`.
5. The message contains the booking reference and the hiker's name.
6. The message contains the booked date, start time, and party size, matching
   the values recorded from the booking.
7. The values in the email correspond to the values recorded from the booking
   review, regardless of the email's whitespace or HTML formatting.

## Scenario 3: A rejected booking does not send a confirmation email

**Given**

1. Mailpit is running and there is no previous message for the hiker's unique
   email address.
2. A hiker account exists with valid credentials, and the hiker is logged in.
3. The selected day contains a visible time with fewer free seats than the
   requested party size, or another documented condition makes the booking
   unavailable.

**When**

1. The hiker opens **Book a table**.
2. The hiker chooses the day.
3. The hiker selects a party size that cannot fit the chosen time.
4. The hiker attempts to continue with the unavailable booking, if the client
   permits the attempt.
5. The test checks Mailpit for a message addressed to the hiker during the
   configured email polling window.

**Then**

1. The booking is not created.
2. No booking confirmation email is received by the hiker.
3. The test does not count messages that were already present before the
   scenario began.

> The email polling timeout used for this negative assertion is a test setting,
> not a business rule. It must be long enough for the application to deliver a
> normal confirmation email in the E2E environment.

## Scenario 4: A booking rejected after the review does not send a confirmation email

**Given**

1. Mailpit is running and there are no previous messages for the two hikers'
   unique email addresses.
2. Two hiker accounts exist with valid credentials, and both hikers are logged
   in or can log in.
3. The booking page has a slot with enough free seats for the first hiker's
   party.
4. The first hiker has selected the day, party size, and time and has opened
   the booking review.

**When**

1. The second hiker books the same available seats and the booking succeeds.
2. The first hiker confirms the booking from the already-open review.
3. The test waits for a response to the first hiker's booking request.
4. The test checks Mailpit for a message addressed to the first hiker during
   the configured email polling window.

**Then**

1. The first hiker's booking request is rejected with `409 Conflict`.
2. The first hiker's booking is not created.
3. The first hiker receives no booking confirmation email.
4. The second hiker's successful booking and any confirmation email are not
   counted as a result for the first hiker.
