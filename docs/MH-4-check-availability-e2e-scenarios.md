# MH-4 - Check availability

These end-to-end scenarios cover story MH-04 only: a user checks whether a party
can sit at a given date and time. They follow the availability mockup
([`docs/mockups/availability`](mockups/availability/README.md)): the search is
on the home page, and the answer is on **Book a table**. They use
Given/When/Then form so they can be translated directly into Playwright tests.

## Shared constraints

1. The check needs a day, a number of people, and a time range with **From**
   and **To**. The day is chosen among the days that have slots. **Check
   availability** is disabled until From and To are chosen.
2. The check is public: no login is required, for the home page and for **Book a
   table**. The login is asked only at **Review booking**, which these scenarios
   do not use.
3. From and To are a search among the slots set by the staff, not a new time: a
   slot overlaps if its interval intersects From/To for a positive duration
   (slot start < To and slot end > From). Touching boundaries do not overlap.
4. **Check availability** opens **Book a table** with the same choices, and that
   page counts overlapping slots that are currently bookable for the selected
   party size:
   - one such slot: it is already chosen and the answer is checked;
   - several such slots: the user chooses one, and the answer is checked for it;
   - no overlapping slot: the answer is **Not available**;
   - overlapping slots but none bookable for the party: the user can choose one
     to see its availability.
5. The answer is based on the free seats of that time and on the table layout.
   A party that does not fit at one table can be split over several tables:
   with 6 free seats split over 3 tables of 2, a party of 6 is available.
6. The answer shows where the seats are, for example 2 + 3 + 1 seats.
7. No alternative is suggested: the answer never names or recommends another
   time, day or date. **Book a table** still lists the times of the day with
   their free seats, as it does for a booking. That list is not a suggestion and
   is not what these scenarios check.
8. The check only gives an answer. It does not book or hold anything.
9. The texts are those of the mockup: **Available**, **Not available**, and the
   reasons "This time has N free seats, not enough for M people.", "This time
   has no free seats." and "No meal slots overlap your selected time range (HH:MM?HH:MM) on this day."
10. A test must be able to set the day, the people, From and To by their
    accessible names (**Day**, **People**, **From**, **To**), without depending
    on how the time wheel is drawn.

## Scenario 1: A visitor who is not logged in checks a party that fits at one table

**Given**

1. The browser has no active session: there is no valid `sid` cookie.
2. The chosen day has one slot with free tables of `4` and `6` seats.
3. No other slot of that day overlaps the From/To range chosen below.

**When**

1. The visitor opens the home page.
2. The visitor chooses the day.
3. The visitor sets the people to `3`.
4. The visitor chooses From and To so that only that slot overlaps that range.
5. The visitor selects **Check availability**.

**Then**

1. The visitor is not asked to log in.
2. The visitor is on **Book a table**, with the chosen day, `3` people and that
   slot already chosen.
3. The answer is **Available**.
4. The detail shows `3` seats at one table.

## Scenario 2: A party that fits only when split over tables is available

**Given**

1. The chosen day has one slot with exactly three free tables of `2` seats each,
   so `6` free seats in total. No table has `6` free seats.
2. No other slot of that day overlaps the From/To range chosen below.

**When**

1. The user opens the home page and chooses the day.
2. The user sets the people to `6`.
3. The user chooses From and To so that only that slot overlaps that range.
4. The user selects **Check availability**.

**Then**

1. The user is on **Book a table** with that slot already chosen.
2. The answer is **Available**.
3. The detail shows `2 + 2 + 2` seats over `3` tables.

## Scenario 3: The detail follows the seats that are still free

**Given**

1. The chosen day has one slot with three tables, and the bookings of other
   parties leave `2`, `3` and `1` free seats on them (`6` free seats in total).
2. No other slot of that day overlaps the From/To range chosen below.

**When**

1. The user opens the home page and chooses the day.
2. The user sets the people to `6`.
3. The user chooses From and To so that only that slot overlaps that range.
4. The user selects **Check availability**.

**Then**

1. The answer is **Available**.
2. The detail shows `2 + 3 + 1` seats over `3` tables.

## Scenario 4: A party bigger than the free seats is not available

**Given**

1. The chosen day has a slot with `5` free seats in total.
2. Another slot of the same day has enough free seats for `6` people.
3. The From and To chosen below include only the slot with `5` free seats.

**When**

1. The user opens the home page and chooses the day.
2. The user sets the people to `6`.
3. The user chooses From and To.
4. The user selects **Check availability**.

**Then**

1. The user is on **Book a table** with the slot of `5` free seats chosen.
2. The answer is **Not available**, with the reason "This time has 5 free seats,
   not enough for 6 people."
3. **Review booking** is disabled.
4. The answer does not name or recommend any other time, day or date, not even
   the slot that has room.

## Scenario 5: A time with no free seats is not available

**Given** (one of the two cases, each run as its own test)

- **Case A:** every seat of the chosen slot is already booked: it has `0` free
  seats.
- **Case B:** no table set has been assigned to the chosen slot yet, so it has
  `0` seats and nothing can be booked there.

In both cases no other slot of that day overlaps the From/To range chosen
below.

**When**

1. The user opens the home page and chooses the day.
2. The user sets the people to `1`.
3. The user chooses From and To so that only that slot overlaps that range.
4. The user selects **Check availability**.

**Then**

1. The answer is **Not available**, with the reason "This time has no free
   seats."
2. **Review booking** is disabled.
3. No alternative is suggested.

## Scenario 6: After "not available" the user checks a different time

**Given**

1. The situation of Scenario 4: the chosen slot cannot take a party of `6`, and
   another slot of the same day can.

**When**

1. The user searches as in Scenario 4 and gets **Not available**.
2. On **Book a table** the user chooses the other time, with the same day and
   people.

**Then**

1. The answer for the new time is **Available**, with its detail.
2. The answer refers to the time now chosen, not to the previous one.

## Scenario 7: Several times match the search and the user chooses one

**Given**

1. The chosen day has two slots that overlap the From/To range chosen below,
   and both have enough free seats for the party.

**When**

1. The user opens the home page and chooses the day.
2. The user sets the people to `3`.
3. The user chooses From and To so that both slots overlap that range.
4. The user selects **Check availability**.
5. The user chooses one of the two times on **Book a table**.

**Then**

1. On arrival, **Book a table** says that `2` slots overlap the selected time range
   and asks the user to choose one.
2. On arrival, no time is chosen, no answer is shown and **Review booking** is
   disabled.
3. After the choice, the answer is **Available**, with the detail for the time
   chosen.

## Scenario 8: Only one overlapping slot has enough free seats

**Given**

1. The chosen day has two slots that overlap the From/To range.
2. One slot has enough free seats for the party; the other does not.

**When**

1. The user searches for the chosen party size and selects **Check availability**.

**Then**

1. The slot with enough free seats is selected automatically.
2. Its availability is checked and shown.
3. The other overlapping time remains visible, but is not counted as a candidate
   for this party size.

## Scenario 9: No time matches the search

**Given**

1. The chosen day has slots, but none overlaps the From/To range chosen
   below.

**When**

1. The user opens the home page and chooses the day.
2. The user sets the people to `2`.
3. The user chooses From and To.
4. The user selects **Check availability**.

**Then**

1. The user is on **Book a table**, with no time chosen.
2. The answer is **Not available**, with the reason "No meal slots overlap your selected time range
   (HH:MM?HH:MM) on this day.", where the times are the From and To chosen.
3. **Review booking** is disabled.
4. No other time, day or date is suggested.

## Scenario 10: The search needs From and To

**Given**

1. The home page is open and the user has chosen a day and the people.

**When**

1. The user looks at the search before choosing From and To.
2. The user then chooses From and To.

**Then**

1. Before the choice, **From** and **To** show **Choose** and **Check
   availability** is disabled.
2. After the choice, **To** is later than **From** and **Check availability** is
   enabled.

## Scenario 11: The check does not book

**Given**

1. The chosen day has one slot with `6` free seats in total.
2. A hiker is logged in and has no booking for that time.
3. No other slot of that day overlaps the From/To range chosen below.

**When**

1. The hiker searches for a party of `6` with From and To that include only that
   slot, and gets **Available**.
2. The hiker repeats the same search.

**Then**

1. The second answer is the same as the first: the slot still has `6` free
   seats.
2. The hiker has no booking for that time.

## Scenario 12: An employee gets the same answer

**Given**

1. An employee is logged in.
2. The chosen day has one slot that fits a party of `3`.
3. No other slot of that day overlaps the From/To range chosen below.

**When**

1. The employee searches for a party of `3` with From and To that include only
   that slot.

**Then**

1. The answer is **Available**, with the same detail a visitor would see.
2. **Book a table** says "Only hikers can book." and **Review booking** is
   disabled.
