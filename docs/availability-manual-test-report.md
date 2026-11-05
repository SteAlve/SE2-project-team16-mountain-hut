# MH-84 — Availability frontend manual test report

## Scope and result

Manual verification of **MH-04 — Check availability**, against the
[MH-4 scenarios](MH-4-check-availability-e2e-scenarios.md) and the
[availability mockup](mockups/availability/README.md), on `dev` after PR #63
was merged. Automated results are not counted as manual results.

**30 checklist items: 26 passed and 4 passed with a finding.** The three findings
(F-01, U-01, U-02) are all **minor and non-blocking**: MH-04 works as specified.

The checklist was first run on the PR branch (`e90dcd5`) and run again in full
on the merged version. The results below are those of the merged version; the
one difference between the two runs is recorded in L-01.

| Run details | Value |
| --- | --- |
| Tester | Hatim Roussi |
| Date | 05/11/2026 |
| Task | [MH-84](https://polito-se2-26-16.youtrack.cloud/issue/MH-84) |
| Branch / commit | `dev` / `a834e59` (PR #63 merged in `0f5d471`) |
| Host | macOS |
| Tools | Chromium DevTools: Network, Console, responsive view |
| Responsive view | 375 × 812 |
| Client / API | Vite dev server / `http://localhost:3001` |
| Database | new local PostgreSQL 16, `npm run db:migrate` then `npm run db:seed` |

## Method and data

The run used the real React frontend, Express backend and a new PostgreSQL
database, so no data of other runs was involved. The seed gave the demo staff and
the demo slots: 12:00–13:00, 13:00–14:00 and 19:00–21:00 on the seeded days, none
on the day of the test.

The search was made on the home page with **Check availability**. To repeat a
search with other values, the address it opens
(`/book?date=…&people=…&from=…&to=…`) was edited by hand; the same address was
used for the checks of values the home page never produces (L-01 to L-04).

Role checks used a new hiker, the seeded employee `james.taylor@quota.example`,
and the visitor without a session.

Examples of data used:
- 6 November (seeded): 12:00–13:00 with 27 free seats, 13:00–14:00 with 35,
  19:00–21:00 with 24.
- 8 November, a day the seed leaves empty, with dedicated slots:

| Time | Tables (seats) | Bookings | Used by |
| --- | --- | --- | --- |
| 09:00–10:00 | 2, 2, 2 | none | A-02, R-02 |
| 10:30–11:30 | 3, 4, 2 | 1 seat on each table: free 2, 3, 1 | A-03 |
| 15:00–16:00 | no tables | — | A-06 |
| 16:30–17:30 | 2 | 2 seats: full | A-05 |
| 18:00–19:00 | 2 | none | A-07, A-09, A-10 |
| 18:30–19:30 | 6 | none | A-07, A-09, A-10 |

The dedicated fixtures were created only in this local database, which was
removed after the run.

## Search on the home page

| ID | Manual check | Result | Observation |
| --- | --- | --- | --- |
| H-01 | Initial form | Pass, with U-01 | Day, People, From and To; From and To show Choose; Check availability disabled. The day is today, which has no slots (U-01). |
| H-02 | Day without slots | Pass | Red message "No meal slots are available on this day. Choose another day." and Check availability disabled. |
| H-03 | From and To required | Pass | Check availability stays disabled until both are chosen (scenario 10). |
| H-04 | To not later than From | Pass | With From 12:30, To 12:00 keeps Done disabled with "Choose a time later than 12:30." |
| H-05 | Search opens Book a table | Pass | 6 November, 3 people, 12:15–12:45 opens `/book` with the same day, people and range. |
| H-06 | Change search keeps the values | Pass | Back on the home page with 6 November, 3 people, 12:30 and 13:30. |

## Availability answer

| ID | Manual check | Result | Observation |
| --- | --- | --- | --- |
| A-01 | One slot overlaps, party fits one table | Pass | 3 people, 12:15–12:45: 12:00–13:00 chosen; Available, 3 seats, 1 table (scenario 1). |
| A-02 | Party fits only when split | Pass | 6 people at 09:00: Available, 2 + 2 + 2 seats, 3 tables (scenario 2). |
| A-03 | Detail follows the free seats | Pass | 6 people at 10:30: Available, 2 + 3 + 1 seats, 3 tables (scenario 3). |
| A-04 | Party bigger than the free seats | Pass | 28 people at 12:00: Not available, "This time has 27 free seats, not enough for 28 people."; Review booking disabled; no other time named (scenario 4). |
| A-05 | Every seat booked | Pass | 1 person at 16:30: Not available, "This time has no free seats."; Review booking disabled (scenario 5, case A). |
| A-06 | Slot without tables | Pass | 1 person at 15:00: same answer as A-05; the time shows Full (scenario 5, case B). |
| A-07 | Other time after Not available | Pass | 6 people, 18:05–18:20: Not available at 18:00. Choosing 18:30 gives Available, 6 seats, and the answer names 18:30–19:30 (scenario 6). |
| A-08 | Two slots overlap, the user chooses | Pass | 3 people, 12:30–13:30: "2 overlapping slots are currently bookable for 3 people. Choose one…", no time chosen, Review booking disabled. Choosing 13:00 shows Checking…, then Available (scenario 7). |
| A-09 | Only one overlapping slot fits | Pass | 4 people, 18:40–18:50: 18:30 chosen automatically and Available; 18:00 still listed with Only 2 seats free (scenario 8). |
| A-10 | No overlapping slot fits | Pass | 7 people, 18:40–18:50: "None of the 2 overlapping slots is currently bookable for 7 people. Choose a time to check its availability." |
| A-11 | No slot overlaps | Pass | 2 people, 15:00–16:00 on 6 November: Not available, "No meal slots overlap your selected time range (15:00–16:00) on this day."; no time chosen (scenario 9). |
| A-12 | Touching boundary does not overlap | Pass | 14:00–15:00 does not match 13:00–14:00: same answer as A-11. |
| A-13 | Party far above the seats of the day | Pass | 40 people: Not available with the reason; every time shows Only N seats free. |

## Roles and booking

| ID | Manual check | Result | Observation |
| --- | --- | --- | --- |
| R-01 | Visitor without a session | Pass | Home page and Book a table open without login; the answer of A-01 is shown (scenario 1). |
| R-02 | The check does not book | Pass | As a hiker, the same search twice gives the same answer (2 + 2 + 2); the database has no booking of that hiker for that slot (scenario 11). |
| R-03 | Employee | Pass | Same answer and detail as a visitor; "Only hikers can book."; Review booking disabled; navbar shows Slots & tables (scenario 12). |
| R-04 | Hiker navbar | Pass | Book a table, name and role Hiker, Log out. |

## Addresses written by hand

| ID | Manual check | Result | Observation |
| --- | --- | --- | --- |
| L-01 | Past day (1 November) | Pass | The past day is dropped and the page opens on the first day with slots (6 November), keeping people and range. On the PR branch it showed 1 November with "No meal slots overlap…"; fixed in the merged version. |
| L-02 | From later than To, or `25:99` | Pass, with U-02 | The range is dropped without a message; Time shows —. |
| L-03 | People `0` or `abc` | Pass, with U-02 | Becomes 1 without a message. |
| L-04 | Day without slots (11 November) | Pass | "No times on this day." and Not available. |

## Visual and responsive inspection

| ID | Manual check | Result | Observation |
| --- | --- | --- | --- |
| V-01 | Answer wording | Pass, with F-01 | Texts match the mockup and the scenarios, except "1 seats" for one person. |
| V-02 | Home page at 375 px | Pass | No horizontal scroll of the page; time pickers usable. |
| V-03 | Book a table at 375 px | Pass | No horizontal scroll of the page; the day strip scrolls sideways inside itself. |

## Findings

### F-01 — "1 seats" for one person

**Status:** minor, non-blocking. Reproduced; no application fix included.

For a party of one, the detail of the answer reads **1 seats** (for example 1
person at 12:00–13:00 on 6 November). The heading is built as
`` `${…join(' + ')} seats` `` in `AvailabilityAnswer.jsx`, with no singular.
Suggested fix: **1 seat** when the total is 1.

### U-01 — The home page opens on a day without slots

**Status:** minor, non-blocking. Usability observation.

The Day field starts on today. After the seed, and on any day the warden has not
planned, the first thing a visitor sees is the red message "No meal slots are
available on this day." before choosing anything. Suggested improvement: start
on the first day that has slots.

### U-02 — Wrong values in the address are corrected without a message

**Status:** minor, non-blocking. Usability observation; only reachable by editing the address.

The home page never produces these values, so a normal user does not meet them.
A wrong range is dropped silently (L-02) and a wrong number of people becomes 1
(L-03). They are read in `lib/availabilitySearch.js`. Suggested improvement: the
same messages as the home page. A past day, also part of this observation on the
PR branch, is handled in the merged version (L-01).

## Outcome and follow-up

- Manual verification recorded: **30 checklist items, 26 passing and 4 passing
  with a finding**; all 12 scenarios of MH-04 behave as written on `dev`.
- All three findings are minor and non-blocking. F-01 is a one-line wording fix for the frontend author.
- U-01 and U-02 can be decided by the team in a later sprint.
- The run used its own local database, removed afterwards; no shared data changed.
- Only documentation is changed by this report.
