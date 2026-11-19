# MH-100 — Booking change frontend manual test report

## Scope and result

Manual verification of **MH-06 — Change a booking**, following the
[MH-06 E2E definitions](../e2e-definitions/MH-6-change-booking-e2e-scenarios.md),
the [booking-management mockup](../mockups/hiker-booking-page/README.md), and
the 20-check frontend manual checklist below (MH6-M01–MH6-M20).
The tester operated the real QUOTA application in the browser and provided
screenshots or explicit confirmations throughout the guided session.

**Result: 20 manual checks performed, 20 recorded as Pass, 0 Fail, 0 Blocked.**
The evidence qualifications and a narrow-viewport observation are documented
below; a recorded Pass is not a claim that every assertion was independently
captured in a screenshot.

| Run details | Value |
| --- | --- |
| Date | 19 November 2026 |
| Tester | Antonio Vitarelli |
| Task | [MH-100 — MH-06 frontend manual testing](https://polito-se2-26-16.youtrack.cloud/issue/MH-100) |
| Branch / commit | `qa` / `b56ee500901e5cf2c625bdc8f4b946f0f7ee385f` (reconstructed from the local `qa` checkout before the report pushes; the running Docker image's build revision was not recorded) |
| Environment | Local QUOTA deployment using Docker Compose |
| Application | `http://localhost:3001` (frontend and API) |
| Page | `/bookings` — My bookings |
| Email capture | Mailpit, `http://localhost:8025` |
| Browser | Google Chrome with DevTools |
| Responsive viewport | **390 × 844** (tester-confirmed); additional observation at 308 × 844 |
| Database | Local PostgreSQL database used by the Docker Compose application |
| Test account | Seeded hiker Lucas Bennett (`lucas.bennett@quota.example`) |

## Method and test data

The tester used a pre-existing, locally persisted booking dataset rather than
resetting the database or mailbox. A change was submitted only for tests that
required persistence; abandoned and invalid edits were intentionally discarded.
Browser Network inspection distinguished `PATCH /api/bookings/:id` requests
from ordinary `slots` reads. Mailpit was used to inspect a change notification
in HTML and plain text. The 48-hour destination restriction was retested
on the same day on both sides of 12:00 local time.

Relevant booking states observed during the run:

| Booking reference | Role in the checks | Observed booking details |
| --- | --- | --- |
| `QUOTA-00017` | Closed editing deadline | 20 Nov, 12:00–13:00, 4 people; Edit disabled, changes closed 18 Nov at 12:00 |
| `QUOTA-00022` | Open/close/escape and deadline retest | 21 Nov, 13:00–14:00, 2 people, Vegan |
| `QUOTA-00023` | Date and time changes | Moved 24 Nov → 25 Nov, 19:00–21:00; then 25 Nov, 19:00–21:00 → 12:00–13:00; 1 person, Vegan |
| `QUOTA-00019` | Party size and dietary changes | Initially 2 people with no dietary needs; increased to 3, subsequently reduced; tester separately changed it to 7 people before the dietary-line checks |
| `QUOTA-00020` | Dietary-only change, invalid party/needs validation, email | 27 Nov, 19:00–21:00, 2 people, T1 · 2; Peanuts → Shellfish → Peanuts for 2 guests |

The checklist is grouped by behavior rather than strict execution time: MH6-M17
includes the later cutoff retest at approximately 12:06, while the email inspected
in MH6-M19 records a change at 12:01. MH6-M18 records the refreshed booking states
before the final Shellfish → Peanuts change in MH6-M19. The separate increase to
7 people on `QUOTA-00019` was test preparation for MH6-M12–MH6-M15, not an
unexpected application change.

## Manual checklist — booking page, editor and discarded edits

| ID | Manual check | Result | Observed behavior |
| --- | --- | --- | --- |
| MH6-M01 | Inspect active booking cards on My bookings | Pass | Future booking cards showed reference, day/time, party size, table allocation, dietary summary and Edit action. |
| MH6-M02 | Inspect disabled Edit inside the 48-hour deadline | Pass | `QUOTA-00017` showed a disabled Edit button and **Changes closed on Wed 18 Nov · 12:00**. A separate attempted click was not explicitly confirmed. |
| MH6-M03 | Open Edit for an eligible booking | Pass | `QUOTA-00022` opened **Change your booking** with 21 Nov, 13:00–14:00, 2 people, 2 Vegan guests, reference and Close/Save actions. |
| MH6-M04 | Change a value, then Close | Pass | A proposed change from 2 to 3 people was discarded; `QUOTA-00022` still showed 2 people, T1 · 2 and Vegan. |
| MH6-M05 | Change a value, then Esc | Pass | Tester confirmed Esc closed the dialog without saving the proposed party-size change. |
| MH6-M06 | Discarded edits: Network and email | Pass | Network showed only `slots` reads (304), no PATCH on the discard flow; tester confirmed no new modification email for `QUOTA-00022`. |

## Manual checklist — saved date, time and party-size changes

| ID | Manual check | Result | Observed behavior |
| --- | --- | --- | --- |
| MH6-M07 | Change only the date | Pass | `QUOTA-00023` moved 24 → 25 Nov while keeping 19:00–21:00, 1 person and Vegan; booking reference and valid T1 · 1 allocation persisted. Success banner not captured. |
| MH6-M08 | Change only the time | Pass | The same reference moved from 19:00–21:00 to 12:00–13:00 on 25 Nov; 1 person, Vegan and T1 · 1 remained. Success banner not captured. |
| MH6-M09 | Increase party size | Pass | `QUOTA-00019` increased from 2 to 3 people without changing day/time or adding dietary needs; allocation changed from T1 · 2 to T4 · 3. |
| MH6-M10 | Decrease party size and release seats | Pass | The booking was reduced 3 → 2, then 2 → 1 in a second check. On **Book a table**, free seats for 25 Nov, 13:00–14:00 increased **18 → 19** after the latter save. The Edit dialog continued showing 20 because it includes the seats of the booking being edited. |

## Manual checklist — dietary-needs changes and validation

| ID | Manual check | Result | Observed behavior |
| --- | --- | --- | --- |
| MH6-M11 | Change only dietary needs | Pass | `QUOTA-00020` changed **Peanuts → Shellfish** for 2 guests. The **Only the dietary needs changed** notice appeared; date, time, party size and T1 · 2 allocation remained unchanged. |
| MH6-M12 | Add a valid dietary-needs line | Pass | On `QUOTA-00019` (now 7 people after a separate tester action), **1 guest — Vegetarian** was added, then appeared in My bookings; table allocation T4 · 4 + T5 · 3 was retained. |
| MH6-M13 | Edit an existing needs line and Done | Pass | The 1-guest line on `QUOTA-00019` changed **Vegetarian → Vegan**, and Vegan appeared on the saved booking; date, time, party size and tables remained unchanged. |
| MH6-M14 | Cancel a nested needs edit | Pass | With Vegetarian temporarily selected in the nested editor, **Cancel** restored the previous Vegan line; main Save was disabled because nothing had changed. |
| MH6-M15 | Remove a dietary-needs line | Pass | The Vegan line was removed from `QUOTA-00019`; after Save, My bookings showed **No dietary needs** with 7 people and T4 · 4 + T5 · 3 unchanged. |
| MH6-M16 | Reject needs exceeding party size | Pass | Reducing `QUOTA-00020` from 2 to 1 person while keeping Shellfish for 2 guests displayed **2 of 1 · more than your party: remove a line or lower its guests**. Network showed no PATCH; reopening the original booking showed 2 people and the dietary requirement intact. |

## Manual checklist — deadline, persistence, notification and responsive layout

| ID | Manual check | Result | Observed behavior |
| --- | --- | --- | --- |
| MH6-M17 | Exclude destination slots inside 48 hours | Pass | Before noon on 19 Nov, 21 Nov 12:00–13:00 was selectable. In the retest at approximately **12:06 on 19 Nov**, that 12:00 slot was absent, while 13:00–14:00 and 19:00–21:00 remained available. Dates 19–20 Nov were not offered. No save was made. |
| MH6-M18 | Persistence after refresh | Pass | After F5, `QUOTA-00023` still had 25 Nov 12:00–13:00, 1 Vegan, T1 · 1; `QUOTA-00019` had 25 Nov 13:00–14:00, 7 people, no needs, T4 · 4 + T5 · 3; `QUOTA-00020` had 27 Nov 19:00–21:00, 2 Shellfish, T1 · 2. |
| MH6-M19 | Successful PATCH and change email | Pass | `PATCH http://localhost:3001/api/bookings/20` returned **200 OK**. `QUOTA-00020` changed Shellfish → Peanuts without changing date/time/people/tables. One new matching Mailpit notification was observed; HTML and plain text both stated reference, 27 Nov 19:00–21:00, 2 people, Peanuts for 2 guests, and **Changed on 19 November 2026, 12:01**. |
| MH6-M20 | Responsive editor usability | Pass | The tester confirmed the mobile responsive flow was usable at the planned target after a check. An intermediate screenshot at **308 × 844** showed possible clipping around the dietary editor's **Lactose-free** option; no confirming screenshot at 390 × 844 or separate end-to-end Close observation was retained. See U-01. |

## Findings and evidence qualifications

### U-01 — Potential narrow-width clipping in dietary editor

**Status:** observation at 308 px; **not confirmed at the planned 390 px viewport**.

During a responsive inspection, the tester called out a possible issue with the
**Lactose-free** option, and the provided 308 × 844 screenshot showed part of the
nested dietary editor outside the immediately visible viewport. The tester later
reported that the responsive behaviour was fine after being asked to check at
390 × 844. This is **not** recorded as a confirmed defect at the target width.
If support for widths around 308 px is required, the nested editor should be
inspected separately for horizontal overflow and reachability of all options.

### Evidence limitations (no additional failures asserted)

- **M02:** disabled Edit and deadline copy were visible; an actual click on
  the disabled control was requested but not explicitly reported.
- **M07/M08:** persisted changes were visible, but success notices were not
  separately captured; their display should not be asserted from this record.
- **M10:** the public free-seat increase was observed on a second reduction,
  not established as a change in the Edit dialog's own inclusive availability
  number. The tester intentionally made a separate later change to 7 people;
  this is not a system-generated anomaly.
- **M17:** the natural real-time crossing of the 48-hour cutoff was observed,
  but no simulated clock or exact server-time boundary test was performed.
- **M20:** the target-viewport result is based on tester confirmation, not a
  retained 390 × 844 screenshot of every control and the final Close action.

## Outcome

- **20 guided manual checks recorded Pass; 0 Fail; 0 Blocked.** Results are
  limited to the observed browser session and confirmations above.
- The 48-hour destination cutoff was confirmed again after the clock crossed
  noon: the 21 Nov 12:00–13:00 destination ceased to be offered.
- The successful modification email was verified in both **HTML** and **plain
  text**, and the corresponding **PATCH 200 OK** was independently confirmed.
- No confirmed functional defect was recorded in the 20 checks. U-01 is a
  separate possible usability issue at a narrower-than-target viewport.
- This report does **not** claim execution of API-only cases, exact mocked
  server-clock boundary checks, forced network failures, deterministic no-seat
  cases, multi-user concurrency, an independent SQL audit, or automated tests.
- The local dataset and Mailpit messages were left in place.
