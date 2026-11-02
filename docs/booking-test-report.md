# Booking test coverage (MH-01)

This report documents the server tests for **MH-01 — Book a table**, including
the availability checks used by the booking flow. It covers unit and integration
tests. Browser/E2E tests are outside its scope.

## Test levels

- **Unit tests:** booking deadlines, seating allocation, input validation and use
  cases with simulated dependencies.
- **Database integration tests:** DAO operations against PostgreSQL, persistence,
  constraints, availability calculations and concurrent booking requests.
- **API integration tests:** HTTP requests through the Express application using
  Supertest, with the real use cases and PostgreSQL database.

## Requirement mapping

| Behaviour | Automated checks |
| --- | --- |
| Required slot, party size and seating data | `server/test/dto/bookings.test.js`, API validation tests |
| Public availability and seating preview | API tests |
| Keep a party together; best fit; split across the fewest tables | Domain seating tests, use-case tests, API tests |
| Tables shared between parties | DAO tests and concurrent API bookings |
| Two-hour deadline, including its exact boundary | Domain and use-case tests; closed-slot API test with a fixed clock |
| One active booking per hiker per slot | DAO, database constraint and API tests, including simultaneous requests by the same hiker |
| Independent availability when slots reuse tables | DAO test using one table set for two slots and the same hiker |
| Staff cannot book | Employee and warden use-case checks, employee API refusal |
| Preview makes no booking; confirmation persists the party | Use-case and API tests, database assertions |
| Tables change between preview and confirmation | Use-case and API conflict tests; a fresh preview permits retry |
| All seats taken before confirmation | Use-case and API tests for NO_SEATS |
| A party may occupy exactly all available seats | Domain, use-case and API exact-fit tests; confirmed by PO issue #12 |
| No fixed maximum party size beyond available capacity | API test accepting a party of 100; confirmed by PO issue #27 |

## Test design

Seating tests check that every party member receives a seat, each table appears
only once, and no assignment exceeds the available capacity. Generated layouts
use a fixed seed and include full tables and non-consecutive table IDs. Optimal
assignments are compared against all possible table subsets for those layouts.

Tests accept equivalent optimal choices without requiring a particular table ID.
Confirmation tests still require the saved assignment to match the actual seating
preview. The closed-slot API test uses a fixed clock to avoid failures caused by
the time of execution.

## Product Owner clarifications

- [Issue #12](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/12#issuecomment-6367725760):
  the Product Owner confirms that six people can use six free seats spread over
  three tables of two. Exact-fit bookings (`partySize <= freeSeats`) are therefore
  accepted, consistently with the example in MH-04.
- [Issue #27](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/27#issuecomment-6480843141):
  the Product Owner specifies no fixed party-size limit. A booking for 100 people
  is accepted when 100 seats are available. This clarification concerns party
  size, not the advance booking window.

## Running the checks

Configure `TEST_DATABASE_URL` in `server/.env` to use a dedicated PostgreSQL test
database. From `server`, run:

```bash
npm run test:coverage
npm run lint
```

The test setup applies migrations automatically. Tests create and remove data,
so the test database must not contain data that needs to be preserved.

## Validation results

The latest validation completed with **189 passing tests across 20 files** and
**no lint errors**.

| Coverage metric | Result |
| --- | ---: |
| Statements | 96.23% |
| Branches | 93.82% |
| Functions | 97.18% |
| Lines | 96.21% |

Coverage includes all JavaScript modules under `server/src`, including startup,
configuration, routes, controllers and DTOs. These figures describe the full
server suite, not only the tests added for MH-01. They do not measure browser code.
Uncovered code includes server startup and some configuration and database error
handling paths.

Requirements: [MH-01](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-01.md)
and [MH-04](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-04.md).
