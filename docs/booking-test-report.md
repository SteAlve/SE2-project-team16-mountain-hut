# Booking test coverage (MH-01)

This report covers server unit, database and API tests for MH-01. Browser/E2E tests
are outside this task's scope. It does not certify later stories or the team's
YouTrack tasks, which were not accessible during review.

## Requirement mapping

| Behaviour | Automated checks |
| --- | --- |
| Required slot, party size and seating data | `server/test/dto/bookings.test.js`, API validation tests |
| Public availability and seating preview | API tests |
| Keep a party together; best fit; split across the fewest tables | Domain seating tests, use-case tests, API tests |
| Tables shared between parties | DAO tests and concurrent API bookings |
| Two-hour deadline, including its exact boundary | Domain and use-case tests; closed-slot API test with a fixed clock |
| One active booking per hiker per slot | DAO, database constraint and API tests, including concurrent requests by the same hiker |
| Independent availability when slots reuse tables | DAO test using one table set for two slots and the same hiker |
| Staff cannot book | Employee and warden use-case checks, employee API refusal |
| Preview makes no booking; confirmation persists the party | Use-case and API tests, database assertions |
| Tables change between preview and confirmation | Use-case and API conflict tests; a fresh preview permits retry |
| All seats taken before confirmation | Use-case and API tests for NO_SEATS |
| A party may occupy exactly all available seats | Domain, use-case and API exact-fit tests; confirmed by PO issue #12 |
| No fixed maximum party size beyond available capacity | API test accepting a party of 100; confirmed by PO issue #27 |

## Running the checks

In `server`: `npm run test:coverage` and `npm run lint`.
Coverage includes every JavaScript module under `server/src`, including startup,
configuration, routes, controllers and DTOs. It does not measure browser code.

Validation: 189 server tests passed across 20 files; server lint passed.
Server coverage: 96.21% lines and 93.82% branches.

Seating checks accept equivalent optimal table choices. Split confirmation tests
derive the expected assignment from the actual preview instead of assuming which
equally suitable table receives the extra person. Confirmation must still preserve
the preview exactly. Generated layouts also check unique table IDs, integer seat
counts, full tables, non-consecutive IDs and preservation of the input layout.
API test helpers assert successful login and preview responses before testing bookings.

## Confirmed Product Owner clarifications

Although MH-01 uses "smaller than", the Product Owner explicitly confirms in
[issue #12](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/12#issuecomment-6367725760)
that a party of six is available when six free seats are spread over three tables
of two. This is also recorded in MH-04. The exact-fit tests
(`partySize <= freeSeats`) are supported by this clarification and do not require
further confirmation.

In [issue #27](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/27#issuecomment-6480843141),
the Product Owner answers "No limit" to the question about minimum and maximum
party size. There is no fixed maximum below the available capacity, so the API
test accepting 100 people when 100 seats are available is valid. This answer
concerns party size, not how far in advance a booking can be made.

Sources: [MH-01](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-01.md),
[MH-04](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-04.md).
