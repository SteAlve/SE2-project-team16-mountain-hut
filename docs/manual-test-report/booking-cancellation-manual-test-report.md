# MH-113 — Booking cancellation frontend manual test report

## Scope and result

This report documents a **manual browser test session** of **MH-08 — Cancel a booking** in the QUOTA Mountain Hut application. The tester verified cancellation controls, confirmation and dismissal behavior, successful cancellation, persistence, the backend response, notification emails, rebooking, and responsive behavior.

The checks were based on the [MH-08 E2E scenarios](../e2e-definitions/MH-8-cancel-booking-e2e-scenarios.md) and the actual observable frontend behavior.

**Result: 16 manual checks performed, 16 Pass, 0 Fail.**

| Run details | Value |
| --- | --- |
| Date | 18 November 2026 |
| Tester | Antonio Vitarelli |
| Task | [MH-113 — MH-08 frontend manual testing](https://polito-se2-26-16.youtrack.cloud/issue/MH-113) |
| Branch / commit | `qa` / `b56ee500901e5cf2c625bdc8f4b946f0f7ee385f` (reconstructed from the local `qa` checkout before the report pushes; the running Docker image's build revision was not recorded) |
| Environment | Local QUOTA deployment using Docker Compose |
| Application | `http://localhost:3001` (frontend and API) |
| Email capture | Mailpit, `http://localhost:8025` |
| Browser | Google Chrome with DevTools |
| Responsive viewport | **390 × 844** |
| Database | Local PostgreSQL database used by the Docker Compose application |
| Test account | Seeded hiker: Lucas Bennett (`lucas.bennett@quota.example`) |

## Method and test data

The tester used the real running frontend and backend. The **My bookings** page was used to open, abandon and confirm cancellation dialogs. Chrome DevTools **Network → Fetch/XHR** was used to observe the cancellation response and verify that opening or dismissing a confirmation did not send a cancellation request. Mailpit was used to inspect cancellation notifications. Persistence was checked by refreshing **My bookings**.

Representative records involved in this session:

| Booking | Original meal | Party size | Use in this session |
| --- | --- | ---: | --- |
| `QUOTA-00018` | 20 Nov 2026, 13:00–14:00 | 2 | Original booking cancelled; absence persisted after refresh; notification checked in HTML and Plain text |
| `QUOTA-00024` | 20 Nov 2026, 13:00–14:00 | 2 | New booking in the previously cancelled slot; then cancelled with HTTP response inspected |
| `QUOTA-00021` | 21 Nov 2026, 12:00–13:00 | 1 | Existing booking used for non-destructive confirmation/dismissal and mobile checks |

The original cancellation email for `QUOTA-00018` recorded **Cancelled on: 18 November 2026, 20:25**. Rebooking the same slot demonstrated that this hiker could book it again.

## Manual checklist — confirmation and cancellation

| ID | Manual check | Result | Observed behavior |
| --- | --- | --- | --- |
| MH8-M01 | Open **My bookings** and inspect cancellation actions on active bookings, including one whose **Edit** action is disabled. | Pass | Each displayed active booking has its own **Cancel booking** button. It remains available when editing is closed. |
| MH8-M02 | Open **Cancel booking** for `QUOTA-00018` without confirming. | Pass | **Cancel this booking?** dialog opens with the correct meal details: 2 guests, 20 Nov 2026, 13:00–14:00, and **Keep booking** / **Cancel booking** actions. |
| MH8-M03 | Select **Keep booking** in the confirmation. | Pass | Dialog closes and `QUOTA-00018` remains unchanged in the booking list. |
| MH8-M04 | Reopen the confirmation and press **Escape**. | Pass | Dialog closes without confirming the cancellation. |
| MH8-M05 | Reopen the confirmation and click outside the dialog. | Pass | Dialog closes and the booking remains present. |
| MH8-M06 | Confirm the cancellation of `QUOTA-00018`. | Pass | Dialog closes; the booking disappears from **My bookings** and a cancellation notification arrives in Mailpit. |
| MH8-M07 | Refresh **My bookings** after the cancellation. | Pass | `QUOTA-00018` stays absent after F5, confirming persistence through a new list load. |
| MH8-M08 | Inspect the cancellation email for `QUOTA-00018` in **Plain text** and **HTML**. | Pass | Both formats contain Lucas Bennett, the reference, original date/time, party size 2, cancellation timestamp, and the statement that seats are free again; they omit dietary and table details. |

## Manual checklist — rebooking, Network and mobile behavior

| ID | Manual check | Result | Observed behavior |
| --- | --- | --- | --- |
| MH8-M09 | Book the same date/time and party size again after cancelling `QUOTA-00018`. | Pass | A new booking, `QUOTA-00024`, appears for 20 Nov 2026, 13:00–14:00, 2 guests. The old reference remains absent. |
| MH8-M10 | Cancel `QUOTA-00024` and inspect the request and subsequent list refresh in DevTools. | Pass | Cancellation response has HTTP **204 No Content**; the bookings list is refreshed with HTTP **200**; the success notice is shown and `QUOTA-00024` is absent from the active list. |
| MH8-M11 | Count cancellation notification emails for `QUOTA-00024`. | Pass | Exactly **one** email was found with the matching cancellation subject. The original booking-confirmation email was not counted. |
| MH8-M12 | Clear Fetch/XHR, then open the cancellation dialog for `QUOTA-00021` without confirming. | Pass | Confirmation opens while Network remains empty: opening the dialog sends no `DELETE` request. |
| MH8-M13 | Select **Keep booking** while observing Network. | Pass | Dialog closes, `QUOTA-00021` remains present, and no `DELETE` request is made. |
| MH8-M14 | Reopen the dialog and press **Escape** while observing Network. | Pass | Dialog closes and no `DELETE` request is made. |
| MH8-M15 | Inspect the cancellation dialog using responsive emulation at **390 × 844**. | Pass | Correct text/layout and accessible **Keep booking** and **Cancel booking** buttons without overlap. |
| MH8-M16 | On mobile viewport, close the dialog by tapping outside it while observing Network. | Pass | Dialog closes; no `DELETE` request is made; `QUOTA-00021` remains present. |

## Email verification

The inspected cancellation email for `QUOTA-00018` contained the following values in both HTML and Plain text:

| Field | Observed value |
| --- | --- |
| Recipient name | Lucas Bennett |
| Booking reference | `QUOTA-00018` |
| Original date | 20 November 2026 |
| Original time | 13:00–14:00 |
| Party size | 2 |
| Cancellation date and time | 18 November 2026, 20:25 |
| Cancellation message | The seats are free again for other guests. |
| Closing message | We hope to see you at the hut another time. |

No dietary requirements or table assignments appeared in the email, as expected for the cancellation notification. A separate check found one cancellation email for `QUOTA-00024`.

## Outcome

- **16/16 executed manual frontend checks passed**; **0 failures** were observed in these checks.
- The cancellation of `QUOTA-00018` persisted after refreshing **My bookings**, and a new booking in the same slot was possible.
- Cancellation of `QUOTA-00024` returned **204 No Content**, followed by a refreshed active-bookings list.
- Opening and dismissing cancellation confirmations did **not** issue `DELETE` requests in the checked cases.
- Cancellation email content was verified in **HTML and Plain text**, and a separate cancellation generated exactly one notification.
- The cancellation dialog was usable at a **390 × 844** responsive viewport.
- This report describes only the local manual session. It does not claim an independent SQL audit, exact seat-count measurements or execution of the automated suite.
