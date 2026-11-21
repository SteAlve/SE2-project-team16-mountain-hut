# MH-5 - Provide party requirements

**Business value:** 970

> As a hiker, I want to specify dietary restrictions and allergies for people in
> my party so that the hut can prepare suitable meals safely.

These end-to-end scenarios cover how a hiker gives the dietary needs and
allergies of the party while booking a table, how they are shown back and
saved, and how they reach the kitchen in the confirmation email. They follow
the MH-05 story, its clarifications and the [dietary
mockup](../mockups/dietary/README.md), and use Given/When/Then form so they can
be translated directly into Playwright tests.

Changing the needs of an existing booking belongs to MH-06 (Scenario 5 of
[MH-6](MH-6-change-booking-e2e-scenarios.md)) and is not repeated here. The
needs are an optional part of the booking of MH-01, so the scenarios of
[MH-1](MH-1-book-a-table-e2e-scenarios.md) and
[MH-3](MH-3-receive-confirmation-e2e-scenarios.md) still hold when none are given.

## How the story is implemented

The product owner's clarification asks for "a list of requirements per booking,
each with its own allergies flag and description", for example three
requirements: *allergies: yes, "1 vegan, peanut allergy"*, *allergies: yes, "1
shellfish allergy"* and *allergies: no, "2 vegetarians"*. The team implemented
it as follows, and the scenarios test this behaviour:

1. **A line is a group of guests with exactly the same needs.** The hiker adds
   lines in **Check your booking**; each line says how many guests it is for.
   The three requirements of the example are three lines with `1`, `1` and `2`
   guests.
2. **The description is a set of choices plus free text.** A line has diets
   (Vegetarian, Vegan, Pescatarian, Lactose-free), allergies (Gluten, Milk,
   Eggs, Peanuts, Tree nuts, Fish, Shellfish), an *Other* diet and an *Other*
   allergy written in words (at most 100 characters each), and *Other requests*
   for the kitchen (at most 300 characters). The preset lists are still to be
   confirmed by the product owner.
3. **The allergies flag is not a checkbox.** The hiker does not tick it: the
   server derives it. A line has `hasAllergies` true when it has at least one
   allergy, preset or written in words, and false otherwise. The flag cannot
   disagree with the allergies, and a client cannot send it.
4. **The API receives one requirement per guest.** A line of `N` guests is sent
   as `N` equal requirements in `requirements`. The server saves them with the
   booking, in the same transaction, and answers them with `hasAllergies`.
   Guests with exactly the same needs are shown together again as one group.
5. **Each requirement says something.** It has a diet, an allergy or a request.
   There can be at most as many requirements as people in the party. A
   requirement is for one guest: the needs are not split over the tables.

## Frontend contract for E2E testability

The frontend may use any component structure, but it must expose the following
observable behaviour. Tests identify controls by accessible role, label and
user-facing text, not by CSS classes or element positions.

### In Check your booking

1. The dialog **Check your booking** has a section named **Dietary needs and
   allergies**, marked **Optional**. With no needs it says **No dietary needs
   or allergies for this booking.**
2. The action to add a line is a button whose name contains **Add a guest's
   needs** (it starts with `+`). Locate it with a pattern such as
   `/Add a guest.s needs/`, because the popup title uses a typographic
   apostrophe (**Add a guest’s needs**).
3. A counter shows the guests counted, for example **1 of 4 guests**. When
   every guest is counted it adds **every guest is counted** and the add button
   is disabled. When the lines count more guests than the party it says **more
   than your party: remove a line or lower its guests**.
4. Adding a line, or pressing **Edit** on a line, opens a popup over the
   dialog with only that line. The popup title is **Add a guest’s needs** for a
   new line and **Edit a guest’s needs** for an existing one. Its actions are
   **Cancel** and **Done**.
5. In the popup, **Guests** is an accessible **group** with **One fewer** and
   **One more** buttons. **Diet** and **Allergies** are accessible **groups** of
   toggle buttons (`aria-pressed`) named after their choice (**Vegan**,
   **Peanuts**, **Other**, and so on). **Other** opens a text field named
   **Which diet?** or **Which allergy?**. **Other requests** is a text field
   named **Anything else the kitchen should know?**. **Remove these needs**
   removes the line.
6. A folded line is a row with its guests (**2 guests**), its needs as chips
   (allergies first, then diets, then the *Other* texts), and the buttons
   **Edit line N** and **Remove line N**. A line with no choice yet says
   **Nothing chosen yet**.
7. **Done** folds a valid line. A wrong line stays open with its problem marked
   and is never folded (see Scenario 6, part A). **Cancel** or Esc leaves the line as it was, and a line
   just added goes away.
8. **Confirm booking** checks every line first: a wrong line is opened with its
   problem and nothing is sent. While the booking is sent the needs controls are
   disabled and the button reads **Booking…**.

### In Table booked and My bookings

1. **Table booked** lists the saved needs under the heading **Dietary needs · N
   of M guests**, with one card per group of guests with exactly the same
   needs, showing the number of guests (**×2**, readable as **2 guests:**), the
   chips and, in quotes, the *Other requests*. Without needs there is no such
   section.
2. In **My bookings** each booking shows its needs as chips, or **No dietary
   needs**; a booking with only a text request shows **Other requests: …**.

### Asynchronous operations

1. Tests wait for visible states (the popup, the folded row, **Table booked**,
   an alert), not for fixed delays.
2. The confirmation email is asynchronous, so tests poll Mailpit as described
   in [MH-3](MH-3-receive-confirmation-e2e-scenarios.md).

## Shared constraints

1. The needs are optional: a booking with none is valid and has an empty
   `requirements` list.
2. A booking has at most as many requirements as people in the party. A line of
   `N` guests counts `N`.
3. Diets and allergies are the preset ones; a hiker can add one more diet and
   one more allergy in words, and other requests for the kitchen.
4. A guest follows **at most one** of Vegetarian, Vegan and Pescatarian. Choosing
   one unselects the others in the editor, and the server refuses a requirement
   with two of them (`400`). A guest can combine any of them with Lactose-free.
5. The allergies flag (`hasAllergies`) is derived by the server from the
   allergies and is never sent by the client.
6. The needs do not change where the party sits or the seats left: the seating
   rule of MH-01 ignores them.
7. The needs are saved together with the booking, in the same transaction. A
   refused booking (`400`, `409`, `422`) saves no needs and sends no email.
8. The server remains authoritative: the browser checks what it can, but the
   server checks every requirement again.

## Test data and environment

1. Use a unique hiker account, and a unique email address, per scenario so a
   message or booking from another test cannot satisfy an assertion.
2. Create the slots and table capacities through test setup. A party of four fits
   at one table in the scenarios below, unless a scenario says otherwise.
3. Use a future day, with the booked time more than two hours from the
   controlled current time (see the *Test data and time* rules of MH-1).
4. Record the booking reference, the day, the time, the party size and the needs
   typed by the hiker before the confirmation, and compare them with **Table
   booked**, **My bookings**, the API answer and the email instead of relying on
   hardcoded values.
5. For persistence, reload **My bookings** or read `GET /api/bookings` and check
   the saved booking, not only what the confirmation page displayed.
6. Capture outgoing email in Mailpit, as in MH-3.

## Scenario 1: A booking with no dietary needs

**Given**

1. A hiker is logged in.
2. The **Book a table** page has an available day and time for a party of four.

**When**

1. The hiker chooses the day, sets the number of people to `4`, chooses the
   time and selects **Review booking**.
2. In **Check your booking**, the hiker does not add any needs.
3. The hiker selects **Confirm booking**.

**Then**

1. **Check your booking** shows **Dietary needs and allergies**, **Optional**
   and **No dietary needs or allergies for this booking.**
2. The booking is saved with `201 Created` and `requirements` is an empty list.
3. **Table booked** has no **Dietary needs** section.
4. **My bookings** shows the booking with **No dietary needs**.
5. The confirmation email has no section about dietary needs.

## Scenario 2: A hiker adds the needs of one guest: a diet and an allergy

This is the first requirement of the product owner's example: one vegan guest
with a peanut allergy.

**Given**

1. A hiker is logged in.
2. The **Book a table** page has an available day and time for a party of four.
3. The hiker has opened **Check your booking** for a party of four.

**When**

1. The hiker selects **+ Add a guest's needs**.
2. The popup **Add a guest’s needs** opens with **1** guest.
3. The hiker selects **Vegan** in **Diet** and **Peanuts** in **Allergies**.
4. Both choices show as pressed.
5. The hiker selects **Done**.
6. The hiker selects **Confirm booking**.

**Then**

1. After **Done** the popup closes and the dialog shows a row with **1 guest**
   and the chips **Peanuts** and **Vegan**, and the counter says **1 of 4
   guests**.
2. The booking is saved with `201 Created` and `requirements` has one entry
   with `diets: ["VEGAN"]`, `allergies: ["PEANUTS"]` and `hasAllergies: true`.
3. **Table booked** shows **Dietary needs · 1 of 4 guests** and one card with
   **×1**, **Peanuts** and **Vegan**.
4. After reloading **My bookings**, the booking shows the chips **Peanuts** and
   **Vegan**.

## Scenario 3: Several requirements for subsets of the party

This is the product owner's example of three requirements: a vegan with a
peanut allergy, a guest with a shellfish allergy, and two vegetarians. The party
is four.

**Given**

1. A hiker is logged in.
2. The hiker has opened **Check your booking** for a party of four.

**When**

1. The hiker adds a line for `1` guest with **Vegan** and **Peanuts**, and
   selects **Done**.
2. The hiker adds a line for `1` guest with **Shellfish**, and selects **Done**.
3. The hiker adds a line, sets **Guests** to `2`, selects **Vegetarian**, and
   selects **Done**.
4. The hiker selects **Confirm booking**.

**Then**

1. After the third line the counter says **4 of 4 guests · every guest is
   counted** and **+ Add a guest's needs** is disabled.
2. The dialog lists three rows: **1 guest** (Peanuts, Vegan), **1 guest**
   (Shellfish) and **2 guests** (Vegetarian), in the order they were added.
3. The booking is saved with `201 Created` and `requirements` has four entries:
   `{ diets: ["VEGAN"], allergies: ["PEANUTS"], hasAllergies: true }`,
   `{ allergies: ["SHELLFISH"], hasAllergies: true }` and two equal
   `{ diets: ["VEGETARIAN"], hasAllergies: false }`.
4. **Table booked** shows **Dietary needs · 4 of 4 guests** and three cards:
   **×1**, **×1** and **×2**.
5. The party still sits where the seating preview showed: the needs did not
   change the tables.

## Scenario 4: The allergies flag is derived from the allergies

Run this scenario at API level (`POST /api/bookings`, with the tables of the
seating preview), with each data set, and check the answer and `GET
/api/bookings`.

| Data set | Requirement sent | `hasAllergies` |
|---|---|---|
| A preset allergy | `{ "allergies": ["EGGS"] }` | `true` |
| An allergy in words | `{ "otherAllergy": "sesame" }` | `true` |
| A diet only | `{ "diets": ["VEGAN"] }` | `false` |
| Other diet and requests only | `{ "otherDiet": "halal", "otherRequests": "No spicy food" }` | `false` |
| A diet and an allergy | `{ "diets": ["PESCATARIAN"], "allergies": ["MILK"] }` | `true` |

**Given**

1. A hiker is logged in and a slot has free seats for the party.

**When**

1. The hiker books with a single requirement from the data set.
2. The test reads the booking back with `GET /api/bookings`.

**Then**

1. The booking is saved with `201 Created`.
2. The requirement in the answer and in the list has the `hasAllergies` of the
   table, with the texts trimmed and `null` for the fields not sent.
3. A request that carries `hasAllergies` is refused with `400`
   (`Unknown field in requirements: hasAllergies`): the server decides the flag.

## Scenario 5: A diet or an allergy that is not in the list

**Given**

1. A hiker is logged in and has opened **Check your booking** for a party of two.

**When**

1. The hiker adds a line, selects **Other** in **Diet**, and the field **Which
   diet?** appears.
2. The hiker selects **Done** with the field empty.
3. The hiker types `halal` in **Which diet?**, selects **Other** in
   **Allergies**, types `sesame` in **Which allergy?**, and selects **Done**.
4. The hiker selects **Confirm booking**.

**Then**

1. With the field empty, the popup stays open and says **Write which diet, or
   unselect Other.**
2. After the texts are typed, the line folds with the chips **sesame** and
   **halal**.
3. The booking is saved with `otherDiet: "halal"`, `otherAllergy: "sesame"` and
   `hasAllergies: true`.
4. **Table booked** shows the chips **sesame** and **halal**.

## Scenario 6: A line that says nothing, or a text that is too long, cannot be sent

The browser and the API check the same rules. Part A runs in the browser and
part B at API level; they are independent.

### Part A: Browser validation

An invalid line cannot be folded: **Done** keeps the popup open and marks the
problem. So a booking is never sent from the browser with an invalid line, and
the test does not need to reach one in any other way. Run part A with each data
set.

| Data set | The hiker enters | Message shown |
|---|---|---|
| Nothing chosen | nothing | **Choose a diet or an allergy, or write a request, or remove this line.** |
| *Other* diet empty | **Other** in **Diet**, **Which diet?** left empty | **Write which diet, or unselect Other.** |
| *Other* allergy empty | **Other** in **Allergies**, **Which allergy?** left empty | **Write which allergy, or unselect Other.** |
| *Other* diet too long | **Other** in **Diet**, 101 characters in **Which diet?** | **Too long: at most 100 characters.** |
| *Other* allergy too long | **Other** in **Allergies**, 101 characters in **Which allergy?** | **Too long: at most 100 characters.** |
| Request too long | 301 characters in **Anything else the kitchen should know?** | **Too long: at most 300 characters.** |

**Given**

1. A hiker is logged in and has opened **Check your booking** for a party of two.

**When**

1. The hiker selects **+ Add a guest's needs** and enters the data set in the
   popup.
2. The hiker selects **Done**.
3. The hiker corrects the problem (chooses something, or types a valid text) and
   selects **Done** again.

**Then**

1. After the first **Done** the popup stays open, the message of the data set is
   shown, and the popup stays open: the line is not closed.
2. No booking request is sent while the line is wrong.
3. After the correction, **Done** folds the line and the message goes away.
4. The longest texts allowed (100 characters for an *Other* diet or allergy, 300
   for the requests) are accepted and fold normally.

### Part B: API validation

**Given**

1. A hiker is logged in and a slot has free seats for a party of two.

**When**

1. The test sends `POST /api/bookings`, with the tables of the seating preview,
   once with each of these `requirements`: `[{}]`, `[{ "otherRequests": "   " }]`,
   a requirement with `otherRequests` of 301 characters, and one with
   `otherDiet` of 101 characters.
2. The test sends the booking again with texts of exactly 100 (`otherDiet`,
   `otherAllergy`) and 300 (`otherRequests`) characters.

**Then**

1. Each request of the first step is refused with `400 ValidationError`
   (`Each requirement needs a diet, an allergy or a request`, `otherRequests
   cannot be empty`, `otherRequests can be at most 300 characters`,
   `otherDiet can be at most 100 characters`), and no booking, no needs and no
   email are created; the seats left do not change.
2. The booking of the second step is accepted with `201 Created` and the texts
   are saved with their full length.

## Scenario 7: A request for the kitchen with no diet or allergy

**Given**

1. A hiker is logged in and has opened **Check your booking** for a party of
   three.

**When**

1. The hiker adds a line for `1` guest, writes `High chair` in **Anything else
   the kitchen should know?**, and selects **Done**.
2. The hiker selects **Confirm booking**.

**Then**

1. The line folds and shows the request, even though it has no diet or
   allergy.
2. The booking is saved with `otherRequests: "High chair"` and `hasAllergies:
   false`.
3. **Table booked** shows the request in quotes, **“High chair”**.
4. **My bookings** shows **Other requests: High chair**, not **No dietary
   needs**.

## Scenario 8: Diets that exclude each other, and diets that go together

**Given**

1. A hiker is logged in and has opened the popup of a new line.

**When**

1. The hiker selects **Vegetarian**, then **Vegan**.
2. The hiker selects **Lactose-free** as well.
3. At API level, the test sends a requirement with `diets: ["VEGAN",
   "VEGETARIAN"]`, and another with `diets: ["VEGAN", "LACTOSE_FREE"]`.

**Then**

1. Selecting **Vegan** unselects **Vegetarian**, and the two are never pressed
   together; **Lactose-free** stays pressed with **Vegan**.
2. The API refuses the first requirement with `400 ValidationError` (`A guest
   can follow only one of VEGETARIAN, VEGAN, PESCATARIAN`) and saves nothing.
3. The API accepts the second one.

## Scenario 9: The needs cannot count more guests than the party

**Given**

1. A hiker is logged in and has opened **Check your booking** for a party of
   three.

**When**

1. The hiker adds a line for `2` guests with **Vegan**, and selects **Done**.
2. The hiker adds a second line and tries to raise **Guests** beyond `1`.
3. The hiker selects **Done** on the second line, and looks at the counter and
   at **+ Add a guest's needs**.
4. At API level, the test sends four requirements for a party of three.

**Then**

1. **One more** is disabled in the second line: only one guest is still free,
   so it cannot go above `1`.
2. After the second line is folded the counter says **3 of 3 guests · every
   guest is counted** and **+ Add a guest's needs** is disabled.
3. The API answers `400 ValidationError` (`There can be at most one
   requirement per person of the party`) and books nothing.
4. A party of three with exactly three requirements is accepted.

## Scenario 10: Cancel, Back and Esc keep the right choices

**Given**

1. A hiker is logged in and has opened **Check your booking** for a party of
   four, with one folded line for `2` guests with **Vegetarian**.

**When**

1. The hiker selects **Edit line 1**, changes the line to **Vegan** and selects
   **Cancel**.
2. The hiker selects **+ Add a guest's needs**, chooses **Fish**, and presses
   Esc.
3. The hiker selects **Back**, and then **Review booking** again.
4. The hiker removes the line with **Remove line 1**.

**Then**

1. After **Cancel** the line is as it was: **2 guests** with **Vegetarian**.
2. After Esc the new line is gone and the counter still says **2 of 4
   guests**.
3. After **Back** and **Review booking** the line is still there, folded.
4. After the line is removed the dialog says **No dietary needs or allergies
   for this booking.**
5. No booking request is sent in any of these steps.

## Scenario 11: The confirmation email carries the needs to the hiker

**Given**

1. Mailpit is running as the application's SMTP server, and there is no
   previous message for the hiker's unique email address.
2. A hiker is logged in and has opened **Check your booking** for a party of
   four.
3. The hiker adds the three lines of Scenario 3 (a vegan with a peanut allergy,
   a shellfish allergy, two vegetarians), and on the shellfish line the request
   `No mushrooms <b>no nuts</b> & "spicy"`, typed in **Anything else the kitchen
   should know?**. It contains HTML-like characters on purpose.

**When**

1. The hiker selects **Confirm booking**.
2. The test waits for the new message in Mailpit and reads its plain-text
   body, and its HTML body (both its source and its rendered text).

**Then**

1. The message is addressed to the hiker and has a dietary needs section, **Dietary needs**.
2. It lists the groups in the order of the lines, each with its number of guests:
   `1 guest` with **Allergies: Peanuts** and **Diet: Vegan**, `1 guest` with
   **Allergies: Shellfish** and the request `No mushrooms <b>no nuts</b> &
   "spicy"` in quotes, and `2 guests` with **Diet: Vegetarian**.
3. The allergies are listed before the diets, as the kitchen reads them.
4. The date, time, party size and booking reference of the message are the ones
   of the booking (MH-3), and the table numbers are not in it.
5. The request is escaped in the HTML version: the source of the HTML body
   contains `&lt;b&gt;no nuts&lt;/b&gt;` and `&amp;`, and does not contain a
   `<b>no nuts</b>` tag of its own, so the rendered text of the message shows the
   characters exactly as typed and `no nuts` is not bold.
6. The plain-text version keeps the request literally, as typed:
   `No mushrooms <b>no nuts</b> & "spicy"`, with no escaping.
7. The request, saved with `201 Created`, is returned unchanged by the API and
   by **Table booked** and **My bookings**, where React shows it as text.

## Scenario 12: Each booking sends only its own needs

**Given**

1. Mailpit is running, and there is no previous message for the two hikers.
2. Hiker A and Hiker B are logged in (two browser contexts).

**When**

1. Hiker A books a table with the need **Vegan**.
2. Hiker B books a table for another slot with the need **Gluten**.
3. Hiker A books a second slot with no needs.
4. The test reads the three messages in Mailpit.

**Then**

1. Hiker A's first message lists only **Vegan**, and Hiker B's lists only
   **Gluten**.
2. Hiker A's second message has no section about needs: it does not repeat the
   needs of the first booking.
3. **My bookings** of each hiker shows only their own needs.

## Scenario 13: A refused booking saves no needs and sends no email

**Given**

1. Mailpit is running, and there is no previous message for the two hikers.
2. A slot has seats for the first hiker's party and the first hiker is logged
   in with a party of two.
3. The first hiker has opened **Check your booking** and added a line for `2`
   guests with **Peanuts**.

**When**

1. A second hiker books the same available seats, and the booking succeeds.
2. The first hiker selects **Confirm booking**.
3. The test waits for the answer, and checks Mailpit during the configured
   email polling window.

**Then**

1. The first hiker's booking is rejected with `409 Conflict` and is not created.
2. When the party still fits at other tables (`TABLES_CHANGED`), **Check your
   booking** stays open with the note **The free tables changed just now. Check
   where your party sits and confirm again.**, and the needs line is still there,
   folded, so the hiker does not type it again. When the seats are gone
   (`NO_SEATS`), the dialog closes with the alert **Those seats were just
   taken…**; the needs are kept for the next review of this page.
3. No needs are saved for the first hiker, and no confirmation email is sent to
   them.
4. The second hiker's booking and email are not counted as a result for the
   first hiker.

## Scenario 14: The same hiker can book again after a refusal for wrong needs

Run this scenario at API level.

**Given**

1. A hiker is logged in and a slot has free seats for a party of three.

**When**

1. The hiker sends `POST /api/bookings` with three requirements, the third with
   a diet that is not in the list (`KETO`).
2. The hiker sends the same booking again with a valid third requirement.

**Then**

1. The first request is refused with `400 ValidationError` (`diets can contain
   only VEGETARIAN, VEGAN, PESCATARIAN, LACTOSE_FREE`); none of the three
   requirements is saved, no seats are taken and no email is sent.
2. The second request is accepted with `201 Created`: the first refusal did not
   count as a booking of the hiker for that slot.

## Open points for the product owners

1. The preset lists of diets and allergies, and the *Other* texts, are the
   team's proposal and are still to be confirmed.
2. The clarification speaks of an allergies flag with a description per
   requirement. The team derives the flag from the allergies instead of a
   checkbox, so it cannot be forgotten. Is this acceptable?
3. A requirement can be added by the staff when they enter a reservation for a
   hiker (MH-07)? Today the staff page does not offer it, although
   `POST /api/staff/bookings` accepts `requirements`.

## Sources

- [MH-05 story](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-05.md)
- [Dietary needs behaviour, MH-05 mockup](../mockups/dietary/README.md)
- [Confirmation email, MH-03](MH-3-receive-confirmation-e2e-scenarios.md)
- [Changing the needs of a booking, MH-06](MH-6-change-booking-e2e-scenarios.md)
