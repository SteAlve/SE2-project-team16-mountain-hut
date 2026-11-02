# Docker test report

The goal of the test is to check that the Docker setup does what [the architecture](architecture.md#6-docker) says and what [MH-75](https://polito-se2-26-16.youtrack.cloud/issue/MH-75) asks: `docker compose up` starts the whole app on a machine that has only Docker.

All the scenarios run so far behaved as expected. The test on a second PC and the first run of the publishing workflow are still open (see [Not tested yet](#not-tested-yet)).

| | |
|---|---|
| Tester | Roussi Hatim |
| Date | 02/11/2026 |
| Branch and commit | `feature/MH-75-docker`, 027ad7d |
| Pull Request | [#37](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/37) |
| Machine | Mac with an ARM processor, no PostgreSQL installed |
| Docker | Docker Desktop, Engine 29.9.2, Compose v5.6.1 |
| Images | `node:22-alpine`, `postgres:16-alpine` |

## How it was tested

- **From nothing:** no container, no volume and no image of the project, then `docker compose up --build` from the root of the repository.
- **The checks of the API:** `curl` for the pages and the API, and `docker compose exec` to look inside the containers and at the database.
- **In the browser:** the steps of the [README](../README.md#run-with-docker) were followed by hand, on http://localhost:3001.
- **After the test:** `docker compose down -v`, so no test data stayed behind.

The scenarios ran before the commit. The commit also has the publishing of the `qa` image, which changes only the workflows and the documentation, not the image.

## Start and contents of the image

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| D-01 | The Compose file is valid | `docker compose config -q` | No error | ✅ |
| D-02 | Build and start | `docker compose up --build` | The image builds; `db` starts first, then `app`; both become `healthy` | ✅ |
| D-03 | Size of the image | `docker images` | A small final image, without the tools of the build | ✅ 248 MB |
| D-04 | Migrations at the first start | `docker compose logs app` | `Applied: 000_users_and_sessions.sql, 001_booking_schema.sql`, then `Server listening` | ✅ |
| D-05 | Not running as root | `docker compose exec app id -un` | `node` | ✅ |
| D-06 | Only what runs is in the image | List `/app/server` and `/app/client`, look for `.env` files and for `vitest` and `eslint` | Only the server, its production dependencies and the built client; no `.env`, no development tools | ✅ |
| D-07 | The database is not open to the machine | `docker compose ps` | `app` publishes port 3001; `db` publishes nothing | ✅ |

## The app in the containers

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| D-08 | Demo data | `docker compose exec app node scripts/seed.js` | The staff, 23 tables and 42 slots are created | ✅ |
| D-09 | The server serves the client | Open `/`, `/book` and `/login` | `200` on all three | ✅ |
| D-10 | Reloading a page | Reload `/book` in the browser | The page loads with the slots of the database, no error | ✅ |
| D-11 | Sign up | `POST /api/auth/register` | `201` | ✅ |
| D-12 | Book a table | Preview of the seating, then `POST /api/bookings` | `201` with the booking and its table | ✅ |

## Restart and stop

| # | Scenario | Steps | Expected | Result |
|---|---|---|---|---|
| D-13 | The data survives | `docker compose down`, then `docker compose up` | The booking, the 42 slots and the hiker are still there; login answers `200` | ✅ |
| D-14 | Migrations at the second start | `docker compose logs app` after D-13 | `Database already up to date.` | ✅ |
| D-15 | Clean stop | `docker compose stop app`, then the exit code of the container | Stops at once, with exit code 0 | ✅ 0.2 s, exit code 0 |

## CI/CD

| # | Check | Result |
|---|---|---|
| C-01 | The workflows pass `actionlint` | ✅ |
| C-02 | The checks of the Pull Request: **Validate branch flow**, **Server: lint and tests**, **Client: lint and build**, **Branch is up to date with dev** | ✅ on [#37](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/37) |
| C-03 | The placeholder of `deploy.yml` is replaced: the job **Deploy** calls `docker.yml` after the checks and the build | ✅ in the file, not run yet |

## Not tested yet

- **A second PC.** The course asks for Docker to be tested on more than one PC. Only one machine has run it so far, an ARM Mac, so a Windows or Intel machine is the most useful.
- **Publishing the image.** `docker.yml` runs only after a merge into `qa` or `main`, so it cannot run on a Pull Request. The first merge into `qa` is its first real test: the `qa` image has to appear in GitHub's container registry.
- **Another port.** `PORT=8080 docker compose up --build`, written in the README, was not tried.
- **Email in Docker.** The mailer (MH-26) is not merged yet, so the Compose file has no SMTP settings and no Mailpit. They are added with it.

## Findings

- **Containers left running keep answering on port 3001.** This happened during the test of the mailer: the containers were still running, a server started by hand printed `Server listening`, but the Vite client reached the app in Docker, with no error. The booking went to the database in Docker. Run `docker compose down` before going back to development without Docker.

## Result

On the machine tested, `docker compose up --build` starts the whole app with only Docker: it builds, applies the migrations, serves the client and the API, keeps the data across a restart and stops cleanly.

MH-75 stays open until a second PC confirms it. The publishing of the image is confirmed by the first merge into `qa`.
