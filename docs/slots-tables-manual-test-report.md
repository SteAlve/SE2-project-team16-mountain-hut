# MH-02 — Slots & tables manual test report

Status: **36 manual checks passed; ST-31 remains manually inconclusive.**
Additional agent-run browser checks reproduced the ST-31 stale-response defect
with controlled API responses and passed ST-38 against an isolated real backend.
These automated checks are not counted as Antonio's manual results.

| Run detail | Value |
| --- | --- |
| Tester | Antonio Vitarelli |
| Preparation date | 2026-11-03 |
| Report branch | `test/slots-tables-manual-report` |
| Initial QA base | `5955cdcdba6122a45270b86c4388c216faaa9cad` |
| Tested version | `origin/dev` at `a8e53fdf29c5598fb2d10ed7d1e97cd8500884d6` (PR #56 merged) |
| Browser / viewport | Google Chrome on Windows PC; responsive checks at 390 × 844 |
| Database | `mountain_hut_test`, selected with `NODE_ENV=test`, as in the booking manual run |
| Client / API | `http://localhost:5173` / `http://localhost:3001` |

## Method

Antonio performs the browser interactions and reports the observed results.
Only observations confirmed during this manual run count as Pass or Fail.
Previous code-review reproductions and automated checks are not manual results.
Results distinguish Pass, Fail, Inconclusive and Not executed.

References: [MH-02 scenarios](MH-2-define-tables-and-slots-e2e-scenarios.md)
and the [Slots & tables mockup](mockups/slots/README.md) in the tested dev commit.
The checklist uses the labels introduced by PR #56.

By the tester's choice, this run exercises the dev commit above, not the QA
integration. Only this report will be submitted from the QA-based report branch.
During execution the working tree is temporarily detached at that dev commit;
the report remains untracked until returning to the report branch.

Use the same setup as the booking manual run: real React frontend, Express
backend started with `NODE_ENV=test`, PostgreSQL database `mountain_hut_test`
and browser DevTools for Network, Console, throttling and responsive checks.
The connection to this database has been verified. Preserve its existing data;
do not run automated tests that clean it during the manual session.
Migration check on the tested dev commit found no pending migrations. Demo staff
already existed; no accounts were added. Existing data at setup: one table set
and two slots. Slot seeding was not run, preserving the existing fixtures.

An unused database `mountain_hut_manual_slots_20261103` was created during
initial preparation. It is not used for this run. No database was reset or deleted.

## Checklist

| ID | Check / expected behaviour | Result | Observation |
| --- | --- | --- | --- |
| ST-01 | Employee login opens `/slots`; correct page and staff navbar | Pass | Tester confirmed the expected behaviour in Google Chrome on Windows PC. |
| ST-02 | Day strip navigation and empty days selectable | Pass | Tester confirmed selection/highlight, updated heading, empty-day message and scrolling in both directions. Chronological slot order will be checked in ST-14. |
| ST-03 | Table-set card shows summary; individual table numbers/capacities and totals agree in copy dialog or assigned slot | Pass | Tester confirmed with screenshots: existing set shows 1 table / 4 seats; copy dialog contains table 1 with capacity 4, total 1 table / 4 seats and By size: 1 × 4 seats. Empty draft row is excluded from the total. |
| ST-04 | Create `Manual Lunch 20261103`: tables 1/4, 2/4, 3/6; total 14 seats | Pass | Tester confirmed tables 1–3 with capacities 4, 4, 6; total 3 tables / 14 seats; By size: 2 × 4 seats · 1 × 6. Save closes the dialog and updates the card without reload. |
| ST-05 | New-table draft: Enter adds a row; automatic next number; save includes typed draft | Pass | Enter and automatic numbering confirmed during ST-04. Tester saved Manual Draft 20261103 with capacity 2 in the draft without Enter; card shows 1 table / 2 seats. |
| ST-06 | Edit and remove table rows; totals and By size update correctly | Pass | Tester confirmed totals 10 → 14 → 8 seats after editing table 1 from 4 to 8 and removing table 2 (6 seats); row count and By size update correctly. Dialog cancelled without saving. |
| ST-07 | Copy a set, edit the copy; source stays unchanged | Pass | Tester confirmed copying Manual Lunch 20261103 (4, 4, 6 seats), changing table 1 to 8 and saving Manual Copy 20261103: copy shows 3 tables / 18 seats; original remains 3 tables / 14 seats. |
| ST-08 | Empty or whitespace-only name and empty table list rejected | Pass | Tester confirmed empty-form errors, rejection of whitespace-only name and rejection of named set without tables. Dialog stays open; cancelling creates no set. |
| ST-09 | Zero, negative, fractional and nonnumeric table numbers/capacities rejected | Pass | Tester confirmed rejection of 0, -1, 1.5 and abc in both table number and capacity, with the expected field messages and no saved set. |
| ST-10 | Duplicate table numbers rejected; corrected values clear relevant errors | Pass | Tester confirmed duplicate number 1 on the second table is rejected with Already used by another table. Restoring number 2 clears the error and preserves capacities 4 and 6. Cancelled without saving. |
| ST-11 | Duplicate set name rejected; entered tables preserved | Pass | Tester confirmed duplicate Manual Lunch 20261103 is rejected with the expected name error; dialog stays open and preserves the entered 2-seat table. After cancellation, the original remains the only set with that name and has 3 tables / 14 seats. |
| ST-12 | Cancel and Escape close dialogs without saving | Pass | Tester confirmed both New table set and Add a slot close with Escape and the on-screen Cancel button, reset entered values when reopened and create no data. Initial confusion concerned the keyboard Delete key (Canc), not a Cancel-button failure. |
| ST-13 | Create future slot 12:00–13:30 with 14-seat set; visible without reload | Pass | Tester confirmed creation on 2026-11-10 with Manual Lunch 20261103: dialog closes, date selected, slot visible without reload with duration 1 h 30 and 14 seats. |
| ST-14 | Create adjacent slots, reuse same set; correct order and totals | Pass | Tester confirmed adding 13:30–14:30 then 11:00–12:00 on 2026-11-10 using Manual Lunch 20261103. Display order is 11:00–12:00, 12:00–13:30, 13:30–14:30; each has 14 seats and day summary is 3 slots / 42 seats. Tables were reused without re-entry. |
| ST-15 | Different slots use different sets independently | Pass | Tester confirmed 2026-11-10 slot 19:00–20:30 uses Manual Copy 20261103 with capacities 8, 4, 6 and 18 seats. Previous three slots retain Manual Lunch 20261103 and 14 seats each; day summary is 4 slots / 60 seats. |
| ST-16 | Empty date/times and end before/equal to start rejected | Pass | Tester confirmed required-field errors for empty times and empty date, and rejection of 16:00–15:00 and 15:00–15:00 with the expected end-time message. Dialog remains open; no slot created; cancelled afterward. |
| ST-17 | Duplicate start on same day rejected; form preserved and day refreshed | Pass | Tester confirmed duplicate 12:00 start on 2026-11-10 is rejected with conflict alert and Already used. Dialog preserves date, end time 14:00 and Manual Copy 20261103 selection. After cancellation, day remains 4 slots / 60 seats with no duplicate. |
| ST-18 | Same start on a different day allowed | Pass | Tester confirmed creation of 12:00–13:30 on 2026-11-11 with Manual Lunch 20261103 and 14 seats. Returning to 2026-11-10 preserves 4 slots / 60 seats. |
| ST-19 | Create slot without tables: zero seats and Choose tables action | Pass | Tester confirmed 2026-11-11 slot 17:00–18:00 saved with No tables for now. Card shows No tables yet, zero-seat booking explanation, 0 seats, dashed border and Choose tables. Day summary is 2 slots / 14 seats. |
| ST-20 | Assign existing set; slot updates without reload | Pass | Tester confirmed assigning Manual Copy 20261103 to 2026-11-11 slot 17:00–18:00 via Give tables. Dialog closes; slot updates without reload to capacities 8, 4, 6 and 18 seats; No tables yet and Choose tables disappear. Day summary becomes 2 slots / 32 seats. |
| ST-21 | Create a set from Add a slot; original form preserved and new set selected | Pass | Guided re-run: tester created Manual Nested Retry 20261103 with one 6-seat table from Add a slot, confirmed return with date/time preserved and new set selected, then explicitly clicked Add slot and confirmed 2026-11-12 slot 12:00–13:00 visible with that set and 6 seats. Earlier attempt created Manual Nested Add 20261103 but had no stored slot; cause unconfirmed, not classified as a defect. |
| ST-22 | Create a set from Choose tables; original slot preserved and new set selected | Pass | Tester confirmed opening Choose tables for the unassigned 2026-11-12 slot 18:00–19:00, creating Manual Choose Flow 20261103 with one 8-seat table from that dialog, returning with the new set selected, then Give tables closing the dialog and displaying the set and 8 seats. No tables yet and Choose tables disappear. Earlier attempts created sets from Add a slot; the final guided sequence verified the intended Choose tables flow. |
| ST-23 | Cancel nested New table set; original dialog values preserved | Pass | Tester confirmed cancelling nested creation of Manual Nested Cancel (3-seat table) returns to Add a slot with 2026-11-13, 15:00–16:00 and Manual Lunch 20261103 preserved. Cancelled set is absent from the options. |
| ST-24 | Reload preserves saved slots, sets and assignments | Pass | After the guided ST-21 re-run, tester confirmed Ctrl+R preserves both 2026-11-12 slots: 12:00–13:00 with Manual Nested Retry 20261103 (6 seats), and 18:00–19:00 with Manual Choose Flow 20261103, (8 seats; actual set name has trailing comma). Summary remains 2 slots / 14 seats; 2026-11-10 remains 4 slots / 60 seats. Earlier absent slot was not stored; no persistence defect established. |
| ST-25 | Public booking availability reflects unassigned versus assigned future slots | Pass | Tester confirmed anonymous /book in Incognito shows 2026-11-13 slot 17:00–18:00 without tables as Full and unselectable for one person. After staff assigns Manual Lunch 20261103 and visitor reloads/reselects date, slot shows 14 free seats and is selectable. |
| ST-26 | Warden can create sets, slots and assignments | Pass | Tester confirmed Emily Parker / Warden login opens Slots & tables; created Manual Warden 20261103 with one 5-seat table, then unassigned 2026-11-14 slot 12:00–13:00 and assigned that set via Give tables. Slot updates to 5 seats without errors. |
| ST-27 | Hiker denied staff page; anonymous visitor redirected to login | Pass | Tester confirmed anonymous /slots redirects to /login with Log in to see the slots and tables. Logging in as manual.slots.hiker@example.com (test HIKER account created through the real registration API) and opening /slots shows Staff only without setup controls. |
| ST-28 | Session loss redirects to login with return context | Pass | Tester confirmed deleting sid in Chrome DevTools while Add a slot is open, then submitting 2026-11-15 12:00–13:00, redirects to /login with Log in to see the slots and tables. |
| ST-29 | Concurrent assignment in two sessions: second assignment reports conflict and refreshes | Pass | Guided re-run on 2026-11-15 slot 18:30–19:30: James and Emily opened Choose tables before either saved. James assigned Manual Lunch 20261103 (14 seats). Emily then attempted Manual Copy 20261103, received the already-has-tables alert and confirmed the slot displays James's set and 14 seats without reload. Initial attempt on 17:00–18:00 was inconclusive; no defect confirmed. |
| ST-30 | Slow network: pending save visible, repeated submission prevented | Pass | Tester confirmed throttled creation of Manual Slow 20261103 with one 3-seat table shows disabled Saving… button, prevents repeated submission and creates a single set. |
| ST-31 | Background slot GET overlapping a save: saved slot/assignment remains visible | Inconclusive | Manual Slow 3G attempts did not obtain the required overlap: GET staff/slots completed before submission. A Pending POST observed by the tester was the save itself, not a pending background GET. This does not confirm or disprove the code-review reproduction with simulated API responses. |
| ST-32 | Network unavailable: readable error, preserved form and successful retry after reconnecting | Pass | Using Chrome DevTools Offline before saving Manual Network 20261103 (one 3-seat table), tester confirmed the generic error and preserved form. After restoring No throttling, retry closes the dialog and creates exactly one set with 1 table / 3 seats. Backend shutdown was not exercised. |
| ST-33 | Add a slot outside current date range; selected day and saved data visible | Pass | Tester confirmed creating 2026-12-10 slot 12:00–13:00 with Manual Lunch 20261103 closes the dialog, selects the date, displays 14 seats and keeps the selected day visible in the extended date strip. |
| ST-34 | Past-day creation displays notice identifying saved date | Pass | Tester confirmed saving 2026-11-01 slot 15:00–16:00 with Manual Draft 20261103 closes the dialog and displays a notice identifying 1 November as before today. |
| ST-35 | Mobile: navbar, day scrolling, slot cards and fixed Add a slot bar usable | Pass | Tester confirmed Chrome responsive view at 390 × 844: navbar menu opens/closes, one-column page has no page-wide horizontal overflow, day strip scrolls sideways, slot details remain readable without overlaps and fixed Add a slot action is clickable. |
| ST-36 | Mobile dialogs: scrolling, actions, table editing and validation usable | Pass | Tester confirmed at 390 × 844: bottom-sheet Add a slot scrolls and actions are reachable; required-time errors are readable; copied table rows use one column with usable number/capacity/remove controls; zero-capacity validation is visible without overlaps; Cancel closes dialogs. |
| ST-37 | Keyboard: labels, focus, tab navigation, Enter and Escape usable | Pass | Tester confirmed desktop Tab/Shift+Tab navigation with visible focus confined to New table set, Enter in draft Seats adds a row without saving, keyboard activation of Cancel closes without saving, and Add a slot fields/options/actions are keyboard reachable with Escape closing. This was a keyboard usability check, not a screen-reader audit. |
| ST-38 | No table sets yet: empty state, unassigned creation and first-set flow | Pass (agent-run browser check) | Executed separately with Playwright/Chromium and real Express/PostgreSQL using mountain_hut_st38_20261103 on API port 3002. Initial counts: 0 sets / 0 slots. Empty state, default unassigned choice, unassigned slot creation, nested first-set creation/selection, assignment and persistence confirmed. Not a manual result from Antonio; see procedure below. |

## Issues and evidence

No manual failures confirmed. ST-31 remains manually inconclusive; a separate
controlled browser reproduction confirmed the defect again on 2026-11-03.
ST-38 was subsequently covered by an agent-run browser check with real backend
and an isolated empty-state database, preserving mountain_hut_test.

Two initially unclear observations were retried step by step: nested slot
creation (ST-21/ST-24) and concurrent assignment (ST-29). The confirmed results
of those repetitions are recorded in the checklist; no defect was established
from the earlier inconclusive attempts.

### ST-31: repeatable controlled browser reproduction

Re-executed on 2026-11-03 against dev commit
`a8e53fdf29c5598fb2d10ed7d1e97cd8500884d6`, using the real Vite/React UI
at http://localhost:5173 and Playwright headless Chromium on Windows.
Playwright intercepted only URLs whose pathname starts with `/api/`.
API responses were simulated; this check does not claim to reproduce the
timing against the real server or to write a real database record.

1. Return a staff employee fixture from `GET /api/auth/me` and `[]` from
   `GET /api/staff/table-sets`.
2. Intercept every `GET /api/staff/slots?...`, capture its current snapshot
   (initially `[]`) and hold its response behind a manually released Promise.
   Hold all initial GETs: the development React mount issued two in this run.
3. Open `/slots`. Verify that Add a slot is enabled despite the pending GETs.
4. Open Add a slot, retain the default current date, enter 12:00–13:30 and
   submit using the default No tables for now choice.
5. Handle the POST with `201` and a valid slot DTO: posted date/times,
   `slotId: 99`, `tableSet: null`, `totalSeats: 0`. Store this DTO in the
   fixture so subsequent new GETs include it. Wait for the dialog to close.
6. Release the held GETs with their earlier empty snapshots. Assert that the
   page displays `No slots on ...` despite the successful POST.
7. Reload. New GETs now return the saved fixture; assert `No tables yet`
   appears for the slot. This demonstrates display loss rather than deletion
   in the simulated server state.

Observed output from the repeated run:

```text
Add enabled while GET pending: true
POST saved: true held GETs: 2
After stale GET: No slots on Tue 3 Nov.
After reload: saved slot visible
```

Expected: a successful save must remain reflected in the UI when an older
read finishes. Actual: the earlier GET replaces the local list and hides it.
In `client/src/hooks/useSlotsTables.js`, the initial GET writes the whole
`loaded` state at line 73; the create handler at line 126 drops its update if
`loaded` is still null. The effect's `current` flag guards effect replacement,
not intervening mutations. Range-extension reads can also overwrite local
mutations; that additional ordering was not exercised by this reproduction.
Possible remedies are invalidating stale reads when mutations succeed or
refetching authoritative data after writes with request ordering protection.

This finding is documented here only; no GitHub issue was created.

### ST-38: isolated empty-state check

Executed by the agent with Playwright headless Chromium on 2026-11-03 against
the same dev commit. A separate Express process ran on port 3002 with database
`mountain_hut_st38_20261103`. Migrations and `seedStaff()` were applied, but
`seedSlots()` was not. A read-only count verified zero sets and zero slots.
The browser used the real UI on port 5173; API routes were forwarded to port
3002 using `route.fetch()` and the actual backend responses, not fixtures.

1. Log in through the real API using the demo employee account.
2. Verify `No table sets yet.` in the card. Open Add a slot and verify the
   empty-state explanatory text and No tables for now selected by default.
3. Create a current-day 12:00–13:00 slot without tables. Verify No tables yet.
4. Open another slot at 14:00–15:00. From its New table set action create
   `ST38 First Set` with one 4-seat table. Save without Enter in the draft.
5. Verify return to Add a slot with 14:00 preserved and the first set selected
   automatically. Save the slot and verify the set appears on it and in the card.
6. Assign that set to the original 12:00–13:00 slot using Choose tables / Give
   tables. Verify no unassigned Choose tables actions remain.
7. Reload, then start a fresh browser session and log in again. Verify the set
   appears in the card and both slots; both assignments persisted.

All behaviour assertions passed. The first harness attempt needed an accessible
name locator correction for the required Name field. A later runner shutdown
interrupted an in-flight GET after assertions completed; a clean fresh-browser
verification waited for route completion and exited successfully. Neither
harness issue is reported as an application defect. The temporary database was
retained; the existing manual-run database was not changed by ST-38.
