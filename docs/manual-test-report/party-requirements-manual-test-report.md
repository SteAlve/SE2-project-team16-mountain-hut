# MH-130 — Party requirements frontend manual test report

## Scope and result

This report documents a **manual browser test session** of **MH-05 — Provide party requirements**. The tester interacted with the running QUOTA application to check how a hiker enters dietary restrictions, allergies and kitchen requests while booking a table, and how those details appear after confirmation.

The checks follow the [MH-05 Product Owner story](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-05.md), the [dietary mockup](../mockups/dietary/README.md) and the observable frontend behavior.

**Result: 30 manual checks performed, 30 Pass, 0 Fail.** Two non-blocking usability improvements were identified.

| Run details | Value |
| --- | --- |
| Date | 18 November 2026 |
| Tester | Antonio Vitarelli |
| Task | [MH-130 — MH-05 frontend manual testing](https://polito-se2-26-16.youtrack.cloud/issue/MH-130) |
| Branch / commit | `qa` / `b56ee500901e5cf2c625bdc8f4b946f0f7ee385f` (reconstructed from the local `qa` checkout before the report pushes; the running Docker image's build revision was not recorded) |
| Environment | Local QUOTA deployment using Docker Compose |
| Application | `http://localhost:3001` (frontend and API) |
| Email capture | Mailpit, `http://localhost:8025` |
| Browser | Google Chrome with DevTools |
| Responsive viewport | **390 × 844** |
| Database | Local PostgreSQL database initialized with the project's demo seed |
| Test account | Seeded hiker: Lucas Bennett (`lucas.bennett@quota.example`) |

## Method and test data

The tester used the actual frontend, backend and PostgreSQL database. Bookings were submitted through the browser and then checked in **Table booked**, **My bookings** and **Mailpit**. Persistence was checked by refreshing **My bookings**. For invalid party-size requirements, Chrome DevTools **Network → Fetch/XHR** was cleared before clicking **Confirm booking**, to verify that no `POST /api/bookings` was issued.

The main exercise reproduced the Product Owner example for a party of four: **one vegan guest with a peanut allergy, one guest with a shellfish allergy, and two vegetarians**. The UI represents this as three lines for four guests. Further runs covered free-text requirements, validation, cancellation/editing of drafts, optional needs and mobile layout.

MH5-M01–MH5-M08 used a party of **four**. The subsequent editing, validation, saved-request and optional-needs checks (MH5-M09–MH5-M25) used a party of **two**. MH5-M26 reduced that party from **two to one**; MH5-M27 checked the resulting invalid guest count, and MH5-M28 corrected it to **one**.

Representative bookings created during the session:

| Booking | Date and time | Party | Requirements |
| --- | --- | ---: | --- |
| `QUOTA-00017` | 20 Nov 2026, 12:00–13:00 | 4 | 1 Vegan + Peanuts; 1 Shellfish; 2 Vegetarian |
| `QUOTA-00018` | 20 Nov 2026, 13:00–14:00 | 2 | One guest with Shellfish, Pescatarian, Lactose-free and `No spicy food` |
| `QUOTA-00019` | 25 Nov 2026, 13:00–14:00 | 2 | No dietary requirements |

These references identify the records in the tester's local demonstration database. The existing booking-change deadline belongs to MH-06 and was not treated as an MH-05 defect.

## Manual checklist — booking and requirements

| ID | Manual check | Result | Observed behavior |
| --- | --- | --- | --- |
| MH5-M01 | Open **Check your booking** as a logged-in hiker, with 4 people and an available slot. | Pass | Correct date/time, party size and seating summary; **Dietary needs and allergies** marked **Optional**; empty state and `0 of 4 guests`. |
| MH5-M02 | Add one guest with **Vegan** and **Peanuts**. | Pass | Popup closes with Done; one folded line shows the green Vegan chip, red Peanuts chip and `1 of 4 guests`. |
| MH5-M03 | Add a second guest with **Shellfish**. | Pass | Second folded line shows Shellfish in red; first line remains unchanged; counter becomes `2 of 4 guests`. |
| MH5-M04 | Add **2 guests** with **Vegetarian** to complete the PO example. | Pass | Three lines represent all four guests; counter reads `4 of 4 guests · every guest is counted`; adding another line is disabled. |
| MH5-M05 | Use **Back** and reopen **Review booking** before submitting. | Pass | All three lines, guest counts and selected options persist in the draft. |
| MH5-M06 | Confirm the four-person booking and inspect **Table booked**. | Pass | Booking succeeds; `Dietary needs · 4 of 4 guests` contains three grouped cards with counts `×1`, `×1` and `×2`. |
| MH5-M07 | Open **My bookings** and refresh the page. | Pass | `QUOTA-00017` and its date, time, party size and Peanuts/Vegan/Shellfish/Vegetarian needs remain visible after refresh. |
| MH5-M08 | Inspect booking confirmation in Mailpit, **HTML and Plain text**. | Pass | Both versions for `QUOTA-00017` include correct booking details and all three dietary groups with guest counts 1, 1 and 2. |

## Manual checklist — editing and input validation

| ID | Manual check | Result | Observed behavior |
| --- | --- | --- | --- |
| MH5-M09 | Select **Other** allergy with an empty **Which allergy?** field, then Done. | Pass | Field and error are red; `Write which allergy, or unselect Other.` appears; editor stays open. |
| MH5-M10 | Correct the allergy by entering **Sesame** and press Done. | Pass | Editor closes and a red Sesame chip appears for one guest; counter is updated correctly. |
| MH5-M11 | Edit Sesame to Mustard, then press **Cancel**. | Pass | Unsaved change is discarded; Sesame remains in the folded line. |
| MH5-M12 | Edit Sesame to Mustard again, then press **Done**. | Pass | Folded line displays Mustard instead of Sesame; guest count remains unchanged. |
| MH5-M13 | Remove the Mustard line using the row's remove control. | Pass | Row disappears; empty-state message returns and counter becomes `0 of 2 guests`. |
| MH5-M14 | Try to save a completely empty needs line. | Pass | `Choose a diet or an allergy, or write a request, or remove this line.` is shown and the editor stays open. |
| MH5-M15 | Select **Vegetarian**, then **Vegan**, then **Pescatarian**, and add **Lactose-free**. | Pass | Selecting each exclusive diet automatically deselects the previous one; final valid combination is Pescatarian + Lactose-free. |
| MH5-M16 | Select **Other** diet and leave **Which diet?** blank. | Pass | The field appears immediately when Other is selected; Done shows `Write which diet, or unselect Other.` and keeps the editor open. |
| MH5-M17 | Enter **101 characters** in **Which diet?**. | Pass | `Too long: at most 100 characters.` appears; the editor remains open. |
| MH5-M18 | Enter **301 characters** in **Other requests**. | Pass | `Too long: at most 300 characters.` appears; the editor remains open. |
| MH5-M19 | Reduce **Other requests** to exactly **300 characters**, save, then reopen Edit. | Pass | Text is accepted, editor closes, and the same request remains available when editing the saved draft line. |
| MH5-M20 | Enter exactly **100 characters** in **Which diet?**. | Pass | Done accepts the verified 100-character input; the custom diet is retained and displayed as a diet chip. |

## Manual checklist — saved kitchen requests and optional needs

| ID | Manual check | Result | Observed behavior |
| --- | --- | --- | --- |
| MH5-M21 | Enter **No spicy food** in Other requests and confirm a booking. | Pass | `QUOTA-00018` is confirmed; **Table booked** displays “No spicy food” below the diet/allergy chips. |
| MH5-M22 | Verify that booking's requirements in **My bookings**, Mailpit and after refresh. | Pass | Shellfish, Pescatarian and Lactose-free are present in **My bookings** after refresh and in the confirmation email; `Other requests: No spicy food` is retained. |
| MH5-M23 | Confirm a new booking **without any dietary requirements**. | Pass | `QUOTA-00019` is confirmed normally; **Table booked** does not show a dietary-needs section. |
| MH5-M24 | Inspect that booking in **My bookings** and refresh. | Pass | `QUOTA-00019` remains visible with the text **No dietary needs** after refresh. |

## Manual checklist — draft consistency and responsive layout

| ID | Manual check | Result | Observed behavior |
| --- | --- | --- | --- |
| MH5-M25 | Add a new Peanuts line, then press **Escape** before Done. | Pass | The new line is discarded; review remains open with the empty state and `0 of 2 guests`. |
| MH5-M26 | Set requirements for **2 guests**, go Back, reduce the party to **1** and reopen review. | Pass | The draft is preserved; `2 of 1 guests` is shown with **more than your party: remove a line or lower its guests**. |
| MH5-M27 | Click **Confirm booking** while the draft still contains `2 of 1 guests`; inspect Network. | Pass | Review remains open and no success is shown. After clearing Fetch/XHR, **no `POST /api/bookings`** was sent. |
| MH5-M28 | Edit the invalid line, reduce its Guests from **2 to 1**, then Done. | Pass | Warning disappears, Peanuts is preserved and counter becomes `1 of 1 guests · every guest is counted`. |
| MH5-M29 | Inspect the guest-needs editor in Chrome mobile emulation at **390 × 844**. | Pass | Diet and allergy cards use three columns; Other requests, scrollable content and Done/Cancel are usable; no evident overlap. |
| MH5-M30 | Inspect **Check your booking** at **390 × 844** after closing the editor. | Pass | Single-column layout, seating summary, needs section and Back/Confirm actions are visible and reachable without evident overlap. |

## Usability observations — proposed improvements

### UX-01 — Hidden dietary chips cannot be expanded on narrow screens

**Classification:** Usability improvement; not a confirmed functional defect.

In **My bookings**, the narrow/mobile layout shows only the first two distinct dietary chips and uses a **`+N` indicator** for the remaining ones (for example, `+2`). The indicator does not open a list or reveal the hidden requirements. This makes it harder for the hiker to review all recorded dietary needs, especially when **Edit** is disabled because the 48-hour modification deadline has passed.

**Suggested improvement:** Make `+N` expandable or provide a read-only details view listing every saved dietary need. Reviewing the information should not depend on whether the booking may still be edited.

The limitation was observed in the narrow/mobile presentation. No separate desktop failure is claimed.

### UX-02 — Other requests are absent from collapsed draft rows

**Classification:** Usability improvement; behavior consistent with the current mockup.

In **Check your booking**, a collapsed guest-needs row shows its guest count and diet/allergy chips but does **not** show the **Other requests** text. The text remains available when the line is reopened and appears correctly after booking in **Table booked**, **My bookings** and email.

**Suggested improvement:** Show a short preview, label or expandable detail for **Other requests** in collapsed rows so users can review kitchen instructions before confirming the booking.

## Outcome

- **30/30 executed manual frontend checks passed**; **0 failures** were observed in these checks.
- The PO example (four guests represented by three requirement groups) was successfully booked and checked in the confirmation screen, **My bookings** and both Mailpit email formats.
- Validations, draft editing/cancellation, guest-count consistency, optional needs and mobile presentation behaved as expected in the executed checks.
- **UX-01 and UX-02** are non-blocking improvement proposals, separate from the test results.
- This report describes only the local manual session. It does not claim an independent SQL audit or execution of the automated suite.
