# MH-02 - Slots & tables manual test report

## Scope and result

Manual checks of **MH-02 - Define slot capacity**, performed by Antonio on
03/11/2026 against **dev commit a8e53fd** and the
[Slots & tables mockup](mockups/slots/README.md).

**38 checklist cases: 33 Pass, 2 Partial (ST-28, ST-30), 2 Inconclusive
(ST-06, ST-31), and 1 Not executed manually (ST-38).**
**Supplementary automated completion: ST-06, ST-31 and ST-38 all passed on
05/11/2026 at `1a03843`, using a fresh isolated database and the real backend.**
The original manual classifications remain unchanged; these three functional
coverage gaps now have explicit automated evidence below.
**ST-28 and ST-30 also passed supplementary automated checks at `760dc59` on
05/11/2026. All five cases originally Partial, Inconclusive or Not executed
manually now have additional passing automated evidence.** This does not
reclassify the original manual run or explain historical observations O-01/O-02.
The successful repeats in ST-21, ST-24 and ST-29 are included in the 33 passes;
their earlier unexplained outcomes remain open observations O-01/O-02.

**1 defect found on the tested version: ST-31**, confirmed by a separate
controlled browser reproduction. The fix in
[PR #64](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/64)
was merged into dev on 05/11/2026. The fixed head `4b44bd7` passed all 16 MH-02
automated tests on an isolated empty database; the regression failed with the
pre-fix hook. This supplementary verification does not change the manual counts.
No post-fix manual retest is claimed.
ST-38 passed only in a separate automated check and is excluded from manual passes.

**This is evidence for the tested dev version, not certification of qa.** The
Slots & tables frontend is not present on qa at the review date. This report
targets dev, where that implementation is present; if integrated into qa later, the QA
integration must be checked separately. None of the corrections below represents
a new manual test run.

| Run detail | Value |
| --- | --- |
| Tester | Antonio Vitarelli |
| Date | 03/11/2026 |
| Task | [MH-83 - MH-02 frontend testing](https://polito-se2-26-16.youtrack.cloud/issue/MH-83) |
| Documentation revision | 05/11/2026, responding to the [PR #57 review](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/57#issuecomment-6660952655) |
| Report branch | `test/slots-tables-manual-report` |
| Tested version | `dev@a8e53fdf29c5598fb2d10ed7d1e97cd8500884d6` (PR #56 merged) |
| Browser / viewport | Google Chrome on Windows PC; responsive checks at 390 x 844 |
| Database | `mountain_hut_test`, selected with `NODE_ENV=test` |
| Client / API | `http://localhost:5173` / `http://localhost:3001` |

## Method and data

Antonio performed the browser interactions and confirmed the observations.
Only those observations count as manual results. Pass applies to the complete
recorded check; Partial means some required actions were not checked;
Inconclusive means the evidence could not establish the result. Controlled
reproductions and automated checks are recorded separately.

The run used the real React frontend, Express backend and PostgreSQL, with
DevTools for Network, Console, throttling and responsive checks. The database
had one table set and two slots at setup. Migrations were already up to date;
demo staff already existed and slot seeding was not run. Existing manual data
was preserved. No automated suite that cleans this database was run as part of
the manual session.

References: [MH-02 scenarios](MH-2-define-tables-and-slots-e2e-scenarios.md) and the
[Slots & tables mockup](mockups/slots/README.md). The checklist uses the labels
introduced by PR #56.

Fixture notes:

- **ST-06:** the starting set is not identified in the original session notes.
  The numbers cannot be reconciled with Manual Lunch (4/4/6); no replacement
  starting state is inferred for that manual run. A separate automated check
  now verifies the behaviour using an explicitly named 4/4/6 source (see below).
- **ST-25:** an additional unassigned slot, 2026-11-13 17:00–18:00, was present
  when the public check was performed. Its creation is not covered by earlier
  checklist steps; this case verifies the observed unassigned-to-assigned
  transition, not that fixture's creation.
- **ST-22/ST-24 literal name:** the saved set name was
  `Manual Choose Flow 20261103,`, including the trailing comma. The checklist
  uses the readable label without that comma; it refers to the same saved set.

## Checklist

| ID | Check / expected behaviour | Result | Observation |
| --- | --- | --- | --- |
| ST-01 | Employee login opens `/slots`; correct page and staff navbar | Pass | Tester confirmed the expected behaviour in Google Chrome on Windows PC. |
| ST-02 | Day strip navigation and empty days selectable | Pass | Tester confirmed selection/highlight, updated heading, empty-day message and scrolling in both directions. Chronological slot order will be checked in ST-14. |
| ST-03 | Table-set card shows summary; individual table numbers/capacities and totals agree in copy dialog or assigned slot | Pass | Tester confirmed with screenshots: existing set shows 1 table / 4 seats; copy dialog contains table 1 with capacity 4, total 1 table / 4 seats and By size: 1 × 4 seats. Empty draft row is excluded from the total. |
| ST-04 | Create `Manual Lunch 20261103`: tables 1/4, 2/4, 3/6; total 14 seats | Pass | Tester confirmed tables 1–3 with capacities 4, 4, 6; total 3 tables / 14 seats; By size: 2 × 4 seats · 1 × 6. Save closes the dialog and updates the card without reload. |
| ST-05 | New-table draft: Enter adds a row; automatic next number; save includes typed draft | Pass | Enter and automatic numbering confirmed during ST-04. Tester saved Manual Draft 20261103 with capacity 2 in the draft without Enter; card shows 1 table / 2 seats. |
| ST-06 | Edit and remove table rows; totals and By size update correctly | Inconclusive (original manual); Pass (supplementary automated) | Original manual evidence records 10 -> 14 -> 8 seats without an identified starting set, so it remains inconclusive. On 05/11/2026, a separate automated check at 1a03843 used a named 4/4/6 set, verified edits to number/capacity, totals 14 -> 18 -> 12, By size updates and Cancel preserving the original stored rows. See automated completion below. |
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
| ST-21 | Create a set from Add a slot; original form preserved and new set selected | Pass (repeat); O-01 open | Guided repeat: created Manual Nested Retry 20261103 with one 6-seat table from Add a slot, returned with date/time preserved and the new set selected, then explicitly saved 2026-11-12 12:00–13:00. The slot was visible with 6 seats. The earlier attempt created Manual Nested Add 20261103 without a stored slot; its cause remains an open observation (O-01). |
| ST-22 | Create a set from Choose tables; original slot preserved and new set selected | Pass | Tester confirmed opening Choose tables for the unassigned 2026-11-12 slot 18:00–19:00, creating Manual Choose Flow 20261103 with one 8-seat table from that dialog, returning with the new set selected, then Give tables closing the dialog and displaying the set and 8 seats. No tables yet and Choose tables disappear. Earlier attempts created sets from Add a slot; the final guided sequence verified the intended Choose tables flow. |
| ST-23 | Cancel nested New table set; original dialog values preserved | Pass | Tester confirmed cancelling nested creation of Manual Nested Cancel (3-seat table) returns to Add a slot with 2026-11-13, 15:00–16:00 and Manual Lunch 20261103 preserved. Cancelled set is absent from the options. |
| ST-24 | Reload preserves saved slots, sets and assignments | Pass (repeat); O-01 open | After the ST-21 repeat, Ctrl+R preserved the 2026-11-12 slots: 12:00–13:00 with Manual Nested Retry 20261103 (6 seats), and 18:00–19:00 with Manual Choose Flow 20261103 (8 seats; see literal-name fixture note). Totals remained 2 slots / 14 seats; 2026-11-10 remained 4 slots / 60 seats. The earlier missing slot remains part of O-01; this pass covers the repeat only. |
| ST-25 | Public booking availability reflects unassigned versus assigned future slots | Pass | Additional fixture observed for this check: 2026-11-13 17:00–18:00 without a table set. Its creation step was not recorded in the earlier checklist. In an anonymous Incognito /book session it appeared Full and unselectable for one person. After staff assigned Manual Lunch 20261103 and the visitor reloaded/reselected the day, it showed 14 free seats and became selectable. |
| ST-26 | Warden can create sets, slots and assignments | Pass | Tester confirmed Emily Parker / Warden login opens Slots & tables; created Manual Warden 20261103 with one 5-seat table, then unassigned 2026-11-14 slot 12:00–13:00 and assigned that set via Give tables. Slot updates to 5 seats without errors. |
| ST-27 | Hiker denied staff page; anonymous visitor redirected to login | Pass | Tester confirmed anonymous /slots redirects to /login with Log in to see the slots and tables. Logging in as manual.slots.hiker@example.com (test HIKER account created through the real registration API) and opening /slots shows Staff only without setup controls. |
| ST-28 | Session loss redirects to login with return context | Partial (original manual); Pass (supplementary automated) | The original manual run verified only the redirect and login message. The automated check at 760dc59 deleted the real sid cookie while Add a slot was open, obtained HTTP 401 with no saved slot, verified return context from=/slots and the login message, then logged in on that same page and returned successfully to /slots with staff controls enabled. |
| ST-29 | Concurrent assignment in two sessions: second assignment reports conflict and refreshes | Pass (repeat); O-02 open | Guided repeat on 2026-11-15 18:30–19:30: James and Emily opened Choose tables before saving. James assigned Manual Lunch 20261103 (14 seats); Emily attempted Manual Copy 20261103, received the already-has-tables alert and saw James's set / 14 seats without reload. The first 17:00–18:00 attempt remains inconclusive with no established cause (O-02). |
| ST-30 | Slow network: pending save visible, repeated submission prevented | Partial (original manual); Pass (supplementary automated) | The original manual check covered table-set creation only. The automated check at 760dc59 delayed real API responses for set creation, slot creation and table assignment. Saving and Cancel were disabled in every case; attempted repeated form submission and disabled-button activation produced only one mutation request per operation. Real responses were 201/201/200, database contents were correct and the assignment persisted after reload. |
| ST-31 | Background slot GET overlapping a save: saved slot/assignment remains visible | Inconclusive (manual); fix verified automatically | Manual Slow 3G attempts did not obtain a GET/save overlap. A separate controlled browser reproduction confirmed the defect on the original tested commit. PR #64 is now merged into dev; its head 4b44bd7 passed the automated regression and all 16 MH-02 tests. The regression failed with the pre-fix hook. No post-fix manual pass is claimed; see supplementary evidence below. |
| ST-32 | Network unavailable: readable error, preserved form and successful retry after reconnecting | Pass | Using Chrome DevTools Offline before saving Manual Network 20261103 (one 3-seat table), tester confirmed the generic error and preserved form. After restoring No throttling, retry closes the dialog and creates exactly one set with 1 table / 3 seats. Backend shutdown was not exercised. |
| ST-33 | Add a slot outside current date range; selected day and saved data visible | Pass | Tester confirmed creating 2026-12-10 slot 12:00–13:00 with Manual Lunch 20261103 closes the dialog, selects the date, displays 14 seats and keeps the selected day visible in the extended date strip. |
| ST-34 | Past-day creation displays notice identifying saved date | Pass | Tester confirmed saving 2026-11-01 slot 15:00–16:00 with Manual Draft 20261103 closes the dialog and displays a notice identifying 1 November as before today. |
| ST-35 | Mobile: navbar, day scrolling, slot cards and fixed Add a slot bar usable | Pass | Tester confirmed Chrome responsive view at 390 × 844: navbar menu opens/closes, one-column page has no page-wide horizontal overflow, day strip scrolls sideways, slot details remain readable without overlaps and fixed Add a slot action is clickable. |
| ST-36 | Mobile dialogs: scrolling, actions, table editing and validation usable | Pass | Tester confirmed at 390 × 844: bottom-sheet Add a slot scrolls and actions are reachable; required-time errors are readable; copied table rows use one column with usable number/capacity/remove controls; zero-capacity validation is visible without overlaps; Cancel closes dialogs. |
| ST-37 | Keyboard: labels, focus, tab navigation, Enter and Escape usable | Pass | Tester confirmed desktop Tab/Shift+Tab navigation with visible focus confined to New table set, Enter in draft Seats adds a row without saving, keyboard activation of Cancel closes without saving, and Add a slot fields/options/actions are keyboard reachable with Escape closing. This was a keyboard usability check, not a screen-reader audit. |
| ST-38 | No table sets yet: empty state, unassigned creation and first-set flow | Not executed (manual); Pass (supplementary automated) | No manual empty-state run was performed. The earlier isolated automated check passed. A fresh automated check at 1a03843 on 05/11/2026 also passed with real API/PostgreSQL: zero initial sets/slots, nested first-set creation, assignment and persistence after reload and a new authenticated session. Excluded from manual passes; see automated completion below. |

## Open observations and remaining checks

- **O-01 - ST-21/ST-24:** the first nested creation produced a set but no stored
  slot. The cause was not established. The guided repeat passed, including
  explicit slot submission and reload persistence; that does not explain or
  dismiss the first outcome. Keep this observation open for investigation.
- **O-02 - ST-29:** the first concurrent-assignment attempt on 17:00–18:00 was
  inconclusive. Its cause remains unknown. The controlled manual repeat on
  18:30–19:30 passed; the first attempt remains a separate open observation.
- **ST-06:** the original manual arithmetic remains inconsistent. The separate
  automated check now confirms editing/removal using a fully specified fixture;
  another manual run is needed only if a manual Pass is required.
- **ST-28:** return context and login back to /slots are now verified automatically
  at `760dc59`. The original manual result remains Partial; another manual run is
  needed only if a manual Pass is required.
- **ST-30:** pending saves and duplicate-submission prevention for set creation,
  slot creation and assignment are now verified automatically at `760dc59`.
  The original manual result remains Partial rather than being rewritten.
- **ST-31:** the fix is merged and verified automatically at `4b44bd7`, as
  detailed below. A manual post-fix retest remains outstanding if a manual result
  is required; do not turn the automated result into a manual Pass.
- **ST-38:** the empty-state flow is covered by the new automated check; perform
  it manually only if a manual result is required.
- **QA integration:** not tested in this report.

## Known defect and supplementary automated evidence

### ST-31: repeatable controlled browser reproduction
Re-executed on 03/11/2026 against dev commit
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

Tracking/fix: [PR #64 - fix(slots): keep saved slots when an older read answers late (ST-31)](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/64),
head `4b44bd7`, merged into `dev` as `142cef0` on 05/11/2026.

### ST-31: post-fix automated verification

Executed on 05/11/2026 using an isolated checkout of PR #64 at `4b44bd7`,
Chromium, the real React/Vite UI, Express and PostgreSQL. The database was newly
created and migrated, without demo slots; it was separate from every manual-run
database. The API ran on port 13064 and the client on port 15164, with the same
isolated database selected for the backend and test fixtures.

- All **16 MH-02 E2E tests passed**, including the stale-read regression and
  the warden scenario that had failed against pre-existing demo data.
- Client lint and production build passed.
- Negative control: keeping the new regression test but restoring only
  `useSlotsTables.js` from `4b44bd7^` caused the regression to fail: the old GET
  hid the saved slot and the page displayed `No slots on ...`. The fixed hook
  was restored afterwards. This confirms that the test distinguishes the fix
  from the previous implementation.
- The temporary database, processes and checkout were removed after verification.

These are automated post-fix results, not additional manual passes and not a
verification of the QA integration. The original manual version and counts above
remain unchanged.

### ST-38: isolated empty-state check (automated only)
Executed by the agent with Playwright headless Chromium on 03/11/2026 against
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

All behaviour assertions passed in the separate automated check. This is supplementary evidence only, not a manual Pass and not a QA integration test.

### Automated completion of ST-06, ST-31 and ST-38 (05/11/2026)

Tested report-branch commit: `1a03843daf43ea1d86e8ae3dce1cc35a336f12ab`, based on
`dev@142cef0` and containing the merged ST-31 fix. The checks used headless
Chromium/Playwright, the real React UI, Express and PostgreSQL. A new database
named `mountain_hut_mh83_auto_<run ID>` was migrated without demo data. The API
ran on port 13083 and the client on port 15183; the database was selected
explicitly for both the API and fixtures. No manual-run database was used.

| Case | Automated result | Evidence |
| --- | --- | --- |
| ST-06 | Pass | Named source `AUTO-ST06-Base-1793896912061`: tables 1/4, 2/4, 3/6. Copy opened with 3 tables / 14 seats. Renaming table 1 to 10 and changing its capacity to 8 produced 18 seats; removing table 3 (6 seats) produced 2 tables / 12 seats. By size was checked at every stage. After Cancel, a database query confirmed the original rows remained exactly 1/4, 2/4, 3/6 and no copy was saved. |
| ST-31 | Pass | Executed the existing MH-02 test `a slot just saved stays on the page when an older read of the slots answers after it` unchanged against the isolated real backend. The saved slot remained visible after releasing the held GET responses. This complements the earlier negative control recorded above. |
| ST-38 | Pass | Read-only counts confirmed 0 sets / 0 slots before the check. Created an unassigned 12:00-13:00 slot on 06/11/2026. From Add a slot for 14:00-15:00, created `AUTO-ST38-First-1793896910607` with a 4-seat draft saved without Enter. Verified return with the original date/time and the new set selected, saved the second slot, then assigned that set to the first. Reload and a fresh login retained both assignments. Final database counts: 1 set and 2 assigned slots. |

These are three supplemental automated case results, not three new manual
passes and not certification of every report case. ST-28/ST-30 were checked in
the additional automated run below; their original manual results remain Partial,
and the historical observations O-01/O-02 remain open.
Screenshots of ST-06/ST-38 and execution output were captured locally. This
documentation update adds no E2E files to the repository. The temporary
database and both processes were removed after the run.

### Automated completion of ST-28 and ST-30 (05/11/2026)

Tested commit: `760dc59fbab44e3ccebedec9990ec4ac6d690037`. Headless
Chromium/Playwright used the real React UI, Express and PostgreSQL. A new
`mountain_hut_mh83_auto_<run ID>` database was migrated without demo data;
only an isolated employee account and fixtures created by these checks were
used. Client/API ports were 15183/13083. No manual-run database was used.

| Case | Automated result | Evidence |
| --- | --- | --- |
| ST-28 | Pass | Opened Add a slot for 06/11/2026 12:00-13:00 while authenticated, removed the real sid cookie and submitted. The actual API returned 401. The browser redirected to /login with the expected message and state `{ from: '/slots', page: 'see the slots and tables' }`. Logging in on that same page returned to /slots with its staff heading and enabled Add a slot action. A database query confirmed that the unauthorized attempt saved no slot. |
| ST-30 | Pass | Created `AUTO-ST30-Set-1793897253560` with one 3-seat table, an unassigned 06/11/2026 12:00-13:00 slot and its subsequent table-set assignment. For each operation, the real request reached the backend and its response was held to simulate network delay. Saving and Cancel were disabled; an extra form submission plus disabled-submit click caused no duplicate request. Exactly one POST for the set (201), one POST for the slot (201) and one PUT for assignment (200) were observed. SQL checks confirmed one set, one slot and the correct assignment; the page still displayed that set after reload. |

The API mutation responses were delayed, not replaced by fake successes. The
checks asserted real database state after each operation. Screenshots captured
the login/return context and all three pending-save states locally. The temporary
database and processes were removed after the run. This update adds no E2E files
to the repository and does not turn either original manual Partial into a manual
Pass.

## Temporary test databases

The two databases below were created for this review activity and are listed for
removal. Their presence does not change the original manual-run database
`mountain_hut_test`, which must be preserved.

| Database | Purpose | Cleanup status |
| --- | --- | --- |
| `mountain_hut_manual_slots_20261103` | Unused preparation database | Present on 05/11/2026; listed for removal, with no test evidence depending on its contents |
| `mountain_hut_st38_20261103` | Separate ST-38 automated empty-state check | Present on 05/11/2026; listed for removal after any needed evidence retention |

No database deletion is claimed by this documentation revision.
