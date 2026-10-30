# MH-4 - Check availability

These end-to-end scenarios cover story MH-04 only: a user checks whether a party
can sit at a given date and time. They use Given/When/Then form so they can be
translated directly into Playwright tests. The words "available" and "not
available" and the way the detail is shown are to be aligned with the MH-04
mockup when it exists.

## Shared constraints

1. The check needs a date, a time and a party size.
2. The check is public: no login is required.
3. The answer is based on the free seats of that time and on the table layout.
   A party that does not fit at one table can be split over several tables:
   with 6 free seats split over 3 tables of 2, a party of 6 is available.
4. The system shows where the seats are, for example 2 + 3 + 1 seats.
5. No alternative slots are suggested: the user can just check a different slot.
6. The check only gives an answer. It does not book anything.

## Scenario 1: A visitor who is not logged in checks a party that fits at one table

**Given**

1. The browser has no active session: there is no valid `sid` cookie.
2. The chosen time has free tables of `4` and `6` seats.

**When**

1. The visitor opens the availability check.
2. The visitor chooses the day and the time.
3. The visitor sets the party size to `3`.
4. The visitor asks for the availability.

**Then**

1. The visitor is not asked to log in.
2. The answer is **available**.
3. The detail shows `3` seats at one table.

## Scenario 2: A party that fits only when split over tables is available

**Given**

1. The chosen time has exactly three free tables of `2` seats each, so `6` free
   seats in total. No table has `6` free seats.

**When**

1. The user chooses the day and the time.
2. The user sets the party size to `6`.
3. The user asks for the availability.

**Then**

1. The answer is **available**.
2. The detail shows `2 + 2 + 2` seats over `3` tables.

## Scenario 3: The detail follows the seats that are still free

**Given**

1. The chosen time has three tables, and the bookings of other parties leave
   `2`, `3` and `1` free seats on them (`6` free seats in total).

**When**

1. The user chooses the day and the time.
2. The user sets the party size to `6`.
3. The user asks for the availability.

**Then**

1. The answer is **available**.
2. The detail shows `2 + 3 + 1` seats over `3` tables.

## Scenario 4: A party bigger than the free seats is not available

**Given**

1. The chosen time has `5` free seats in total.
2. Another time on the same day has enough free seats for `6` people.

**When**

1. The user chooses the day and the time.
2. The user sets the party size to `6`.
3. The user asks for the availability.

**Then**

1. The answer is **not available**.
2. No other time, day or date is suggested, not even the one that has room.

## Scenario 5: A time with no free seats is not available

**Given** (one of the two cases, each run as its own test)

- **Case A:** every seat of the chosen time is already booked: it has `0` free
  seats.
- **Case B:** no table set has been assigned to the chosen time yet, so it has
  `0` seats and nothing can be booked there.

**When**

1. The user chooses the day and the time.
2. The user sets the party size to `1`.
3. The user asks for the availability.

**Then**

1. The answer is **not available**.
2. No alternative is suggested.

## Scenario 6: After "not available" the user checks a different time

**Given**

1. The situation of Scenario 4: the chosen time cannot take a party of `6`, and
   another time on the same day can.

**When**

1. The user asks for the availability and gets **not available**.
2. The user chooses the other time and asks again, with the same party size.

**Then**

1. The answer for the new time is **available**, with its detail.
2. The answer refers to the time now chosen, not to the previous one.

## Scenario 7: The check does not book

**Given**

1. The chosen time has `6` free seats in total.
2. A hiker is logged in and has no booking for that time.

**When**

1. The hiker checks the availability for a party of `6` and gets **available**.
2. The hiker checks the same time and party size again.

**Then**

1. The second answer is the same as the first: the time still has `6` free seats.
2. The hiker has no booking for that time.
