# MH-82 — Booking frontend manual test report

## Scope and result

Manual verification of **MH-01 — Book a table**, against the
[booking mockup](../mockups/booking/README.md). Antonio performed the browser
interactions and confirmed the observations below. Automated results are not
counted as manual results.

**35 checklist items: 34 passed and 1 failed (M-21).** A separate usability
observation concerns the deadline label at narrow window widths.

| Run details | Value |
| --- | --- |
| Tester | Antonio Vitarelli |
| Date | 02/11/2026 |
| Task | [MH-82](https://polito-se2-26-16.youtrack.cloud/issue/MH-82) |
| Branch / commit | `test/MH-82-booking-frontend` / `460b71f` |
| Host | Windows |
| Tools | Browser DevTools: Network, Console, cookies, throttling and responsive view |
| Responsive view | 390 × 844, plus observation while narrowing the window |
| Client / API | `http://localhost:5173` / `http://localhost:3001` |
| Database | `mountain_hut_test`, selected with `NODE_ENV=test` |

## Method and data

The run used the real React frontend, Express backend and PostgreSQL test database.
Two hiker sessions, including a separate Incognito window, were used for competing
bookings. Seeded employee and warden accounts were used for role restrictions.

Network failures were produced by stopping only the backend while Vite remained
running. Session loss was tested by removing the `sid` cookie with review open.
Loading and repeated-click behaviour were inspected with network throttling.

The results describe the manual browser session. Responsive checks covered the
mobile menu, sideways day navigation, stepper, bottom summary, review sheet and
successful booking ticket. These observations are recorded below rather than
counting the entire checklist twice.

Examples of data used:
- 3 November: slots with 27, 35 and 24 free seats for capacity checks.
- Slots filled by bookings of all 20 seats, then inspected as an anonymous visitor.
- 3 November, 12:00–13:00: 22 people allocated as 4 + 4 + 6 + 8 at tables 3–6.
- 3 November, 17:10–18:10: dedicated slot without tables (ID 4937).
- 2 November, 00:10–01:10: dedicated closed slot with tables (ID 4936), with
  booking deadline 22:10 on the previous day.

The two dedicated fixtures were created only in the test database, without
changing existing slots. Cases initially lacking these data were subsequently
executed and confirmed by the tester.

## Booking behaviour

| ID | Manual check | Result | Observation |
| --- | --- | --- | --- |
| M-01 | Public access to `/book` | Pass | Page opens without login; Log in is visible. |
| M-02 | Initial form and required time | Pass | One person; decrement and review disabled; selection hint visible. |
| M-03 | Day marked no slots | Pass | Clicking does not select it. |
| M-04 | Full slot and slot without tables | Pass | Both show Full and cannot be selected; unassigned fixture checked separately. |
| M-05 | Slot past its two-hour deadline | Pass | 00:10–01:10 shows Closed at 22:10 and cannot be selected. |
| M-06 | Party larger than one slot's capacity | Pass | With 25 people, the 24-seat time is disabled with Only 24 seats free; larger times remain available. |
| M-07 | Exact fit | Pass | 24 people can select the slot with 24 seats. |
| M-08 | Stepper limits | Pass | Increment disabled at the day's maximum of 35; decrement disabled at 1. |
| M-09 | Selected time becomes too small | Pass | Increasing from 24 to 25 clears the 24-seat time and disables review. |
| M-10 | Change day | Pass | Switching from 3 to 6 November preserves 2 people, clears time and disables review. |
| M-11 | Extend day strip | Pass | Dates beyond 15 November become reachable. |
| M-12 | Guest login with choices | Pass | Login explains the booking requirement; day, people and time are restored. |
| M-13 | Employee access | Pass | Staff restriction and employee role shown; review disabled. |
| M-14 | Warden access | Pass | Staff restriction and warden role shown; review disabled. |
| M-15 | Single-table review | Pass | Correct day/time and 2 people at one table. |
| M-16 | Back and Escape without saving | Pass | Choices preserved; no POST to `/api/bookings` for either action, checked in Network. |
| M-17 | Split-party review | Pass | 22 people over 4 tables, 4 + 4 + 6 + 8; split explanation visible. |
| M-18 | Confirm and inspect ticket/Network | Pass | Correct saved details; one request returns 201. Success also confirmed in responsive view. |
| M-19 | Success-screen navigation | Pass | Book another table resets to 1 and no time; Back to the hut page opens `/`. |
| M-20 | Competing booking changes tables | Pass | Notice and new allocation appear; a second explicit confirmation succeeds. |
| M-21 | All remaining availability of the day is taken during review | **Fail — F-01** | Seats-taken notice appears, but the chosen party size is reduced to 1. |
| M-22 | Duplicate booking by the same hiker | Pass | Duplicate-booking message instead of a second success. |

## Loading, session and network errors

| ID | Manual check | Result | Observation |
| --- | --- | --- | --- |
| E-01 | Throttled confirmation and repeated clicks | Pass | Booking… observed; Confirm and Back disabled; only one request sent. |
| E-02 | Remove `sid` during review and confirm | Pass | Redirected to login without a false success. |
| E-03 | Stop backend and reload booking page | Pass | General error visible and Review booking disabled. |
| E-04 | Stop backend with review open and confirm | Pass | General error; no Table booked; pending state ends. |
| E-05 | Restart backend and retry | Pass | Availability returns and booking succeeds without clearing storage or restarting Vite. |

## Visual and responsive inspection

| ID | Manual check | Result | Observation |
| --- | --- | --- | --- |
| V-01 | Form legibility and hierarchy | Pass | Headings, days, stepper and slots readable and ordered. |
| V-02 | Summary updates and placement | Pass, with U-01 | Values update correctly; responsive bottom bar visible; deadline wording needs improvement. |
| V-03 | Review presentation | Pass | Values readable; bottom sheet on mobile, Confirm above Back. |
| V-04 | Scrolling, clipping and overlapping controls | Pass | Controls reachable; no unwanted page overflow or obstructed actions reported. |
| V-05 | Keyboard navigation and focus | Pass | Visible focus, understandable order, focus contained in review. |
| V-06 | Responsive menu and interactions | Pass | Menu opens/closes; days scroll sideways; stepper and dialog buttons respond. |
| V-07 | Errors and confirmation ticket | Pass | Messages and saved details readable without overlap. |
| V-08 | Console during normal use | Pass | No unexpected red errors reported; deliberately induced API failures excluded. |

## Findings

### F-01 — Party size becomes 1 after the whole day becomes full

**Status:** reproduced manually; no application fix included.

While review is open for a party larger than one, another hiker exhausts the
remaining seats of the selected day. Confirmation correctly reports that seats
were just taken, but the form then displays **1 person** instead of preserving
the selected group size, as the mockup specifies.

Earlier attempts with another time still available were not counted as
reproductions. The tester subsequently confirmed the reduction to 1 after filling
all remaining slots of the day. Review this behaviour with the frontend author.

### U-01 — Narrow-view deadline label does not specify the day

**Status:** usability observation reported during manual responsive testing.

At reduced window widths, the bottom summary says **book until HH:MM**, for
example **book until 11:00** for the 6 November, 13:00–14:00 selection.
The date appears elsewhere in the bar, but the deadline itself does not identify
its day. The tester found the meaning unclear: until 11:00 on which day?
The same concern applies to a label such as **book until 17:00**.

The two-hour calculation is correct. Suggested improvement:
**Book until 11:00 on Fri 6 Nov**, or equivalent wording that makes the deadline
date explicit. This is a usability recommendation, not an additional confirmed
Product Owner requirement.

## Outcome and follow-up

- Manual verification recorded: **34 passing checklist items, 1 failure**, plus
  the separate deadline-label usability observation.
- Normal networking restored and the backend restarted successfully.
- F-01 requires review and retesting after a frontend fix.
- U-01 requires a wording/layout decision and responsive retest.
- Test bookings and dedicated fixtures remain available for reproduction; agree
  cleanup with the team rather than removing development data.
- Only documentation is changed by this report.

Responsive observations above describe the checks confirmed during this session,
rather than a second complete execution of all scenarios on a physical phone.
