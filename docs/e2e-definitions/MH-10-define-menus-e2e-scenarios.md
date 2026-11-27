# MH-10 - Define menus

These end-to-end scenarios cover how staff write, read, reuse, edit and delete
the menu of a meal slot, and how hikers and visitors see the saved result. They
use Given/When/Then form for translation into Playwright tests. This definition
covers the work requested in MH-190.

The product owner confirmed free-text menus that staff can reuse and change
(#39). MH-10 requires bold, italic, list items and sub-items. Clarification #59
keeps an edit local to its slot and permits deletion only for future slots.
It supersedes the menus mockup's statement that staff cannot remove a menu.
The team flow allows the warden as well as employees to manage menus, allows a
slot to be booked without a menu, and excludes menu photos. The 2000-character
limit, text normalization, and the selector's search and paging are current
implementation details.

Selected-slot menu display and the effects of staff changes are in scope.
MH-11 covers comparing menus across time-slot cards and choosing a meal from
those previews. PO clarification #55 leaves menus out of a default weekly
schedule copy and permits an optional inclusion. Schedule-copy coverage belongs
to MH-09. The existing slot, booking, dietary needs and booking-change suites
cover their respective flows. This definition covers text menus only.

> **Implementation note:** Review the scenarios after the relevant frontend and
> backend changes are integrated and before writing executable E2E tests. The
> local QA baseline includes backend PRs #163 and #173. PR #176
> (`feature/frontend-story-10`, inspected at `1399703`) adds the staff UI,
> the post-add editor and the `MENU_LOCKED` error code. Both revisions expose
> the public menu endpoint. Menu rendering in **Book a table**,
> **Check availability** and **My bookings** remains planned on those revisions.
> PR #179 defines backend coverage for validation, permissions, reuse,
> independence and started-slot rejection. The staff time comparison and the
> E2E server clock limitations are recorded below.

## Frontend contract for E2E testability

### Labels and controls

1. On **Slots & tables**, identify a slot by its service date and time range,
   with the table-set name when applicable. Scope repeated menu actions to that
   slot's list item and dialog.
2. A slot with a menu shows a summary and **Show menu**. The **Menu** dialog
   identifies the slot and shows the full formatted content. A future slot
   without a menu offers **Write the menu**. A future slot with a menu offers
   **Edit menu** and **Delete menu** in the reader.
3. The staff browser route is `/slots`. A hiker opening it directly sees
   **Staff only**. A visitor is redirected to login. Desktop dialogs and
   phone sheets support the same actions.

### Menu editor and formatting

1. **Write the menu** and **Edit the menu** use a multiline textbox labelled
   **Menu**. The **Format of the menu** toolbar exposes **Bold (Ctrl+B)**,
   **Italic (Ctrl+I)**, **List**, **Sub-item (Tab)** and
   **Up a level (Shift+Tab)**.
2. The editor restores saved formatting when editing or copying. The staff
   reader and selector preview render emphasis and nested lists. Check the
   bold and italic runs and the parent-child relationship of list items in the
   rendered DOM. For example, the staff reader uses `strong`, `em`,
   `ul` and `li`.

### Previous-menu selection

1. **Choose a menu** in a new editor, or **Start from a previous menu** when
   editing or after a copy, opens the selector when eligible menus exist.
   The selector shows one entry per distinct saved text, using the most
   recently saved matching slot and excluding the slot being edited.
2. **Search the menus** matches menu text and supported dates. Use a unique
   dish and an ISO service date (`YYYY-MM-DD`) for deterministic searches.
   The first result may already be selected. Identify the source by date,
   time and menu text.
3. The selected result exposes the full formatted menu in **Preview** on
   desktop or inside the selected entry on a phone. **Use this menu**
   replaces the editor draft and shows the copy source. **Back** keeps the
   draft. **Show older menus** appears when another page exists
   (10 results per page in PR #176).
4. An unmatched query shows “No menu has … Try a dish or a day.” and
   **Use this menu** is disabled. If no eligible previous menus exist, the
   editor omits the previous-menu entry point.

### Confirmation, saving and deletion

1. **Save menu** saves the draft for the identified slot. **Cancel** discards
   an ordinary draft. After **Add slot** saves a future slot, **Write the
   menu** opens for it and **Skip for now** closes the editor.
2. **Delete menu** in the reader opens confirmation for that slot.
   **Keep the menu** backs out. **Delete menu** at confirmation submits the
   removal. The deletion leaves the slot and its reservations in place.
3. PR #176 disables the submitting action while pending and uses
   **Saving…** or **Deleting…**. Success closes the dialog, updates the row and
   shows a notice naming the affected date and time.

### Validation and temporal restrictions

1. The editor shows a character count out of 2000. Saving requires visible
   text. The count uses Unicode code points in the normalized stored text,
   including formatting marks and internal newlines. Normalization converts
   CRLF and CR to LF, removes trailing whitespace on each line and removes
   surrounding blank lines. The editor also drops empty list items.
2. PR #176 displays “Write the menu, or start from a previous one.” for
   empty input and “The menu can be at most 2000 characters.” for overlong
   input. Invalid content leaves the saved state intact.
3. A menu is writable only while the hut's current instant is strictly before
   the slot start. At the start, a slot with a menu becomes read-only and a
   slot without a menu cannot get one. The backend already rejects valid late
   writes and deletes with `422`. QA has no `MENU_LOCKED` code on that
   response. PR #176 adds it and uses it to close stale dialogs, refresh the
   day and show “This slot has started: its menu can no longer be changed.”
4. The PR #176 staff UI uses the browser's local time and a strict `>` check
   for the start comparison. It can still show management actions at exact
   equality. Scenario 9 specifies the inclusive lock expected in the UI.

### Hiker and visitor visualization

1. **Book a table** shows the full formatted menu for the selected slot in
   the mockup's booking summary. An empty slot uses the mockup message
   “No menu yet for this time. You can still book it.”
2. **My bookings** shows a menu summary on the matching booking. The mockup
   offers **Show menu** and **Hide menu**. The no-menu message is
   “No menu yet for this time.”
3. **Check availability** starts on the public landing page and opens the
   availability result on **Book a table**. The menus mockup shows the
   selected menu in the desktop summary and behind **Show menu** in the
   phone result bar. It specifies the same no-menu message as **Book a
   table**. Menu reading requires no login. Use the integrated control names
   and empty-state wording when implementing these checks.
4. The public `GET /api/slots/{slotId}/menu` returns the slot's current
   menu or `menu: null` for a slot without one. Use it to complement browser
   checks. A working endpoint alone does not demonstrate menu rendering.

## Shared constraints

1. Each slot owns its menu. Reuse copies text into the target draft.
   Saving or deleting one slot's menu changes only that slot's menu.
2. From its start instant onward, a slot keeps its saved text or its
   no-menu state. A historical menu remains readable in the staff reader
   and public menu endpoint and can be reused as a source.
3. An employee and the warden can manage future menus. Hikers and visitors
   can read published slot menus. Staff listing and write operations require
   a staff session.
4. A missing menu has no effect on the slot's capacity, reservations or
   eligibility for booking. Use slots with the required seating and booking
   window when demonstrating bookability.
5. Each scenario and variant starts from its own fixture. When verifying
   persistence, reload or revisit the relevant date and slot and wait for the
   corresponding data to load.

## Scenario 1: An employee creates and reopens a slot menu

**Given**

1. An employee is logged in. A future slot has no menu and a different slot
   has a distinct saved menu.

**When**

1. Open **Slots & tables**, choose the target date, and select **Write the
   menu** for the target slot.
2. Enter an identifiable multiline menu with distinct first and last lines and
   select **Save menu**.
3. Open **Show menu** for the target. Reload the page, return to the same date
   and reopen the menu.

**Then**

1. The save succeeds and the notice identifies the target date and time.
2. The **Menu** dialog identifies the target slot and displays the complete
   saved text before and after reload.
3. The other slot's menu is unchanged.

## Scenario 2: An employee creates a formatted menu

**Given**

1. An employee is logged in. A future, bookable slot has no menu.

**When**

1. Open **Write the menu**. Use the toolbar to make a short title bold,
   italicize a distinct phrase, and create two top-level bullets. Use
   **Sub-item (Tab)** to nest another item under the first bullet. Use
   **Up a level (Shift+Tab)** to return to the top level as needed.
2. Save the menu, open **Show menu**, then reload and reopen it.
3. Where the hiker menu UI is integrated, open **Book a table** in a separate
   authenticated hiker context and select the same slot.

**Then**

1. The full menu is present and the intended text is visibly bold and italic
   in the staff reader before and after reload.
2. The two bullets are peers and the sub-item is nested under the first one.
   The hiker view preserves that structure and emphasis when available.

## Scenario 3: An employee edits an existing menu

**Given**

1. An employee is logged in. A future slot has a saved menu with a bold title
   and a list. A second slot has a different saved menu.

**When**

1. Open **Show menu** for the target and select **Edit menu**.
2. Inspect the prefilled editor, replace an identifiable dish and save.
3. Reopen the target menu after the success notice and again after reload.

**Then**

1. The editor opens with the current text, title formatting and list intact.
2. The replacement dish appears, the removed dish is absent, and the
   formatting outside the edit is preserved, including after reload.
3. The second slot still shows its original menu.

## Scenario 4: An employee searches, previews and reuses a previous menu

Run the search-and-copy variants independently by unique dish and by ISO date.
Use separate fixtures for no results, older results and an empty history.

**Given**

1. An employee is logged in. The future target has no menu. In the
   search-and-copy variants, another slot has a distinctive formatted menu and
   neither its dish nor its service date matches any other fixture.
2. For older results, there are 11 distinct eligible menus with ordered save
   times in an isolated store. For no results, at least one other slot has
   a saved menu. For empty history, the isolated store has no eligible menus.

**When**

1. Open **Write the menu**. In each search-and-copy variant type a distinct
   temporary draft. For the populated variants select **Choose a menu**
   and wait for the initial results.
2. For search and copy, type the variant's query in **Search the menus**,
   select the matching source and inspect its preview. Select **Use this
   menu**, then **Save menu**. Reload and open the target menu.
3. For no results, search for an unmatched term. For older results, use
   **Show older menus** and select the older entry. For empty history, inspect
   the editor after its initial previous-menu lookup completes.

**Then**

1. Search finds the matching slot. The preview shows the full source with
   emphasis and nested lists. The copy replaces the draft, identifies the
   source and preserves the formatting. The target retains the full copied
   menu after reload.
2. An unmatched query shows the empty search state and cannot be applied.
3. The older-results action appends the older entry to the existing results.
   Its full preview can be opened, and the paging action disappears after
   the final page.
4. With no previous menus, the editor has no reuse action and still accepts
   a newly written menu.

## Scenario 5: Menus with a common source can be changed independently

Run both variants independently.

**Given**

1. An employee is logged in. In the reuse variant, a past slot has a saved
   formatted menu and a different future target has no menu.
2. In the identical-text variant, two distinct future slots already contain
   identical saved menu text.

**When**

1. For reuse, open the future target's editor, select the past menu and use it
   as the draft. Change one identifiable line and save the target.
2. For identical text, edit and save a changed line in only one of the two
   slots.
3. Reload, navigate to each involved slot and open its full menu.

**Then**

1. The target shows the modified text only. The past source still shows its
   original full menu and remains read-only.
2. In the identical-text variant, the edited slot shows the replacement and
   the other still shows the original, even after reload.

## Scenario 6: An employee deletes only the target slot's menu

**Given**

1. An employee is logged in. A future slot and a different slot have
   identical menus. The target has an assigned table set, a confirmed
   reservation and remaining seats.
2. Record the target slot's identity, table set, booking reference, assigned
   tables and availability for a fixed additional party size.

**When**

1. Open the target's **Show menu** dialog, select **Delete menu**, and select
   **Delete menu** again in the confirmation state.
2. After the deletion notice, reload and inspect both slots, the existing
   reservation and the target's availability.
3. Use **Write the menu** to assign a different menu to the original target.
   Reload and reopen it.

**Then**

1. The target shows a no-menu state after deletion and reload. It still has
   the same slot identity, schedule and table set.
2. The other slot retains the original menu. The confirmed reservation, its
   table assignments and the target's available seats are unchanged.
3. The same future slot accepts the new menu and displays it after reload.

## Scenario 7: Invalid menus are rejected and the length boundary is accepted

Run each creation variant with a fresh future slot. Repeat the overlong
variant in edit mode to check protection of an existing saved menu.

**Given**

1. An employee is logged in. The creation target has no menu. The edit
   variant has a distinct saved menu.
2. The creation inputs are empty text, whitespace only, an empty bullet or
   formatting with no visible text, normalized text of 2001 code points, and
   normalized text of exactly 2000 code points. For the last two, use
   1998 ASCII letters followed by `🍲Z` and append one extra ASCII character
   for the overlong case. The emoji counts as one code point. Surrounding
   blank lines and trailing spaces may be included to exercise cleanup.

**When**

1. Open the appropriate editor and enter the input. Use the **List** button
   for the empty-bullet variant. In edit mode replace the original draft.
2. Select **Save menu**. Observe the feedback, then reload and inspect the
   same slot.

**Then**

1. Empty, whitespace-only and format-only input show the visible-text
   validation message. Empty editor list items contribute no visible text.
2. The overlong input displays the length validation message. After reload,
   every invalid creation target is still empty. The invalid edit leaves the
   original saved menu intact.
3. The valid boundary shows `2000 / 2000`, saves successfully and reopens
   with the complete normalized text, including the final `Z`.

## Scenario 8: Closing a menu flow discards unsaved changes

Run each action independently.

**Given**

1. An employee is logged in. Use a future slot without a menu for creation
   and a future slot with a saved menu for editing and deleting. A separate
   reusable menu exists for the selector and copy variants.

**When**

1. Creation variant. Type a draft in **Write the menu** and select **Cancel**.
2. Edit variant. Change the prefilled text and select **Cancel**.
3. Selector variant. Enter an identifiable, formatted draft, open the
   selector and choose **Back** without using a menu. Inspect the editor,
   then cancel the draft.
4. Copy variant. Select a source and choose **Use this menu**, then choose
   **Cancel** in the editor before saving.
5. Deletion variant. Open deletion confirmation and choose **Keep the menu**.
6. Reload and reopen the affected slot or menu.

**Then**

1. Returning with **Back** preserves the text and formatting of the original
   unsaved draft.
2. **Keep the menu** returns to the full reader with the saved menu intact.
3. After reload the creation target is still empty, and any pre-existing
   target or source menu remains unchanged.

## Scenario 9: Menus become read-only at slot start

Run separate sets of fixtures for slots with and without menus.

**Given**

1. An employee is logged in. In each set, use three non-overlapping slots
   that are future, ongoing and completed at a controlled hut instant.
   The ongoing slot has started and has yet to end.
2. For each menu state, use a fresh fixture at the exact start boundary.
   Fix the browser clock at one millisecond before the start and then at
   the start itself, reopening the slot date at each instant. Use the
   injected server clock for the separate exact server-boundary checks.

**When**

1. Open the slot dates and inspect the menu actions. Use **Show menu** for
   each slot with a saved menu.
2. Compare the future controls with those at the exact start, during the slot
   and after its end. Reload and recheck the started slots.

**Then**

1. Before start, a slot without a menu offers **Write the menu**, and the
   reader for a slot with a menu offers **Edit menu** and **Delete menu**.
2. At the start, during the slot and after its end, existing menus are
   readable in full and offer neither edit nor delete. Empty started slots
   communicate that no menu can be added and expose no write action.
3. After reload each started slot retains its original menu or no-menu state.

## Scenario 10: A slot starts while a menu action is open

Run independent create, edit and delete variants. The stale browser flow
requires control of the running server's clock.

**Given**

1. An employee is logged in. The server and browser start before the
   target's scheduled start. The target has no menu for creation and a saved
   menu for editing or deletion.
2. Open **Write the menu** or **Edit the menu** and enter a valid changed
   draft. In the delete variant open **Delete menu** confirmation.

**When**

1. Hold the stale browser view open with its action still available. Advance
   the server's supported test clock to the exact start instant, leaving
   the browser clock before the start for submission.
2. Select **Save menu**, or confirm **Delete menu**, and wait for the server
   response. Then align the browser clock with the hut and reload the slot.

**Then**

1. The real request is rejected by the server with `422`. The integrated
   contract uses `MENU_LOCKED` and displays a visible explanation that the
   slot has started.
2. After reload, the creation target still has no menu, and the edit and
   delete targets retain the original menu in full. The staff view offers
   no further management for the started slot.

## Scenario 11: An employee writes or skips a menu after adding a slot

Run the save and skip variants independently.

**Given**

1. An employee is logged in. The chosen future day has a valid unused time
   range and an existing table set.

**When**

1. Use **Add a slot** and submit **Add slot** with the fixture's day, times
   and table set.
2. In the menu prompt that follows, write and save a menu in the save
   variant. Select **Skip for now** in the skip variant.
3. Reload and navigate to the newly created slot.

**Then**

1. **Write the menu** opens for the new slot after slot creation succeeds.
   Its date and times match the slot just added.
2. In both variants exactly one new slot exists and keeps its chosen time
   range and table set. The save variant shows the full saved menu. The skip
   variant shows no menu and offers **Write the menu** for later.

## Scenario 12: Only employees and the warden can manage menus

Run one fixture per role.

**Given**

1. An employee, a warden and a hiker have valid accounts. The visitor context
   has no session. Each fixture has a future slot with a known menu.

**When**

1. As employee or warden, open **Slots & tables**, edit the target menu and
   save it. Reopen it, confirm its deletion and write a replacement from
   the empty state.
2. As hiker or visitor, check the navigation and open `/slots` directly.
   If needed to verify server enforcement, send a valid menu write or
   delete request from the same context against the fixture slot.
3. Re-read the target from the staff view after each restricted attempt.

**Then**

1. Each staff variant can edit, delete and create a menu on the target. Its
   replacement is visible after reload.
2. The hiker sees **Staff only** and the visitor is redirected to login.
   Neither is presented with staff menu actions. If used, the API check
   returns `403` for the hiker and `401` for the visitor.
3. The restricted attempts leave the fixture's saved menu unchanged.

## Scenario 13: A hiker sees the menu of the selected slot in Book a table

**Given**

1. A hiker is logged in. Two future slots on the same date can seat the
   chosen party and have distinct menus. One menu has bold and italic text
   and nested bullets.

**When**

1. Open **Book a table**, choose the date and party size and select the
   first slot. Wait for that slot's menu to appear.
2. Select the second slot and then return to the first.

**Then**

1. The menu display follows the selected slot on every change. The other
   slot's dishes are absent from the selected-slot menu display.
2. The formatted menu displays its full text, emphasis and list hierarchy.

## Scenario 14: A hiker can expand the menu for a booking

**Given**

1. A hiker is logged in with two upcoming reservations for different slots
   with distinct menus. Record each reference, slot, party size and table
   assignment.

**When**

1. Open **My bookings**, identify the target reservation and use its
   **Show menu** control. Inspect the full menu and use **Hide menu**.
2. Reload and locate the same reservations.

**Then**

1. The expanded menu matches the target reservation's slot. The other
   reservation keeps its own menu.
2. Hiding the expansion leaves the reservation intact. After reload both
   reservations retain their recorded details and the target menu can be
   opened again.

## Scenario 15: A visitor sees the selected menu through Check availability

**Given**

1. A visitor has no authenticated session. Two future slots on the same day
   fit the party and fall inside the availability search range. Each has a
   distinct saved menu.

**When**

1. Enter the day, party size and time range on the public landing page and
   select **Check availability**.
2. Inspect the first slot's full menu in the result, using **Show menu**
   where the phone presentation requires it. Choose the second slot and
   inspect its full menu.

**Then**

1. Both menus can be read before login and the result follows the current
   slot. The previous slot's menu is absent from the selected result.
2. No menu editing or deletion controls are available in the public flow.

## Scenario 16: A saved menu change reaches hikers and visitors

Run independent variants for first creation and for editing.

**Given**

1. An employee and a hiker are signed in using separate browser contexts.
   A visitor uses a third, unauthenticated context.
2. The hiker has an upcoming reservation for a target slot with seats
   remaining. The target starts empty in the creation variant and has a
   known menu in the edit variant. A different bookable slot and reservation
   provide unchanged comparisons.

**When**

1. Record the target's starting menu state in **Book a table**,
   **My bookings** and **Check availability**.
2. In the staff context save a distinct new menu for the target.
3. Revisit or reload each reader and select the target slot or reopen the
   reservation's menu. Inspect the comparison slot and reservation too.

**Then**

1. All three views show the latest saved menu for the target. The earlier
   text or no-menu message is gone after navigation or reload.
2. The comparison menu and both reservations retain their prior details.

## Scenario 17: Menu deletion reaches hikers and visitors without removing a booking

**Given**

1. An employee, a hiker and an unauthenticated visitor use separate contexts.
   The hiker has a confirmed reservation for a future slot that has a saved
   menu and enough seats for an additional test party. Record the reservation
   details and the slot's availability for that party.

**When**

1. Confirm the saved menu is visible for the target in **Book a table**,
   **My bookings** and **Check availability**.
2. In the staff context, delete the target menu and wait for success.
3. In each reader, reload or revisit the target. Check the booking and
   availability with the same party size as before.

**Then**

1. The deleted text is absent in all three views. Each displays its
   no-menu state for the target slot.
2. The reservation is still confirmed with the same reference, slot, party
   size and tables. The target remains available with the same seating as
   before deletion.

## Scenario 18: A hiker books a slot without a menu

**Given**

1. A hiker is logged in. A future slot has no menu, has enough seats for
   the party and is still inside the hiker booking window.

**When**

1. Open **Book a table** and select the fixture's date, party size and slot.
2. Observe the no-menu message, then review and confirm the booking through
   the existing booking flow.
3. Open or reload **My bookings**.

**Then**

1. The selected slot communicates that no menu has been assigned and still
   offers the booking action.
2. The booking succeeds and appears under the correct date, time and party
   size with the no-menu state for that reservation.

## Test data and environment

1. Use the isolated PostgreSQL environment and fixture/cleanup patterns of
   the existing Playwright suite with data independent of the demo dataset.
   Create accounts, slots, table sets and bookings through the existing DAO
   fixtures. Use the historical-menu fixture pattern from PR #179 to set the
   menu and its saved timestamp on a test slot that has already started.
   Clean up only the data owned by each scenario. Use an isolated menu store
   for empty history and paging because the selector searches across slots.
2. Give slots unique date/time combinations and menus unique dish tokens,
   except where identical text is intentional. Give menu read/booking
   scenarios two non-overlapping selectable slots where needed. Keep
   slots used for booking or availability comfortably before the hiker
   booking cutoff.
3. Use the configured `HUT_TIME_ZONE` (default `Europe/Rome`) and align the
   Playwright context time zone. For exact browser checks use
   `page.clock.setFixedTime` to hold the browser's date at the chosen instant
   while timers still run. Derive that instant from the hut-local slot date
   and time with the project's `clock.at` convention.
4. The existing Playwright launcher starts a separate server process with a
   real clock and has no test clock control. The menu use cases already accept
   an injected clock, as exercised in PRs #176 and #179. Keep the exact server
   boundary at that layer until the running test server can be controlled.
   Scenario 10's full stale browser flow remains pending that capability.
   Browser clock mocking alone cannot establish a server rejection at
   equality. A mocked response can check UI feedback only.
5. Use accessible roles, labels and stable visible text rather than layout
   positions or CSS classes. Wait for the visible result of saves, reloads
   and debounced searches or their correlated completed requests. Use no
   fixed sleeps. Use API or database reads to verify slot identity, booking
   allocations or server decisions where the browser cannot show them.

## Sources

- [Official MH-10 story](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-10.md)
  and [MH-11 story](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-11.md).
- PO answers on [menu text and reuse (#39)](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/39#issuecomment-6797804356),
  [slot-specific edits and deletion (#59)](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/59#issuecomment-7215713082)
  and [default weekly copy (#55)](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/55#issuecomment-7159433035).
- Desktop and phone mockups for [menus](../mockups/menus/README.md),
  [slots](../mockups/slots/README.md), [booking](../mockups/booking/README.md),
  [availability](../mockups/availability/README.md),
  [My bookings](../mockups/hiker-booking-page/README.md) and the
  [MH-11 meal details proposal](https://github.com/SteAlve/SE2-project-team16-mountain-hut/blob/docs/mockup-story-11/docs/mockups/meal-details/README.md).
- [OpenAPI on the QA baseline](../openapi.json), backend
  [PR #163](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/163)
  and [PR #173](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/173).
- Staff frontend [PR #176](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/176),
  [reviewed branch revision](https://github.com/SteAlve/SE2-project-team16-mountain-hut/tree/13997032bc71371a81b1137de230b82d0c9fa2e3),
  and backend unit and integration tests in
  [PR #179](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/179).
- Existing E2E definitions for [MH-02](MH-2-define-tables-and-slots-e2e-scenarios.md),
  [MH-04](MH-4-check-availability-e2e-scenarios.md),
  [MH-06](MH-6-change-booking-e2e-scenarios.md) and
  [MH-09](MH-9-repeat-weekly-schedule-e2e-scenarios.md), and the
  [Playwright server launcher](../../e2e/start-server.js).
- [Playwright Clock API](https://playwright.dev/docs/api/class-clock#clock-set-fixed-time).
