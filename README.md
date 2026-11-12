# Mountain Hut — Team 16

Repository of Team 16 for the **Software Engineering 2 (SE2)** project, academic year **2026/2027**: a web application that supports the activities of a mountain hut.

The requirements (context and user stories) are in the shared repository [AY26-27-Mountain-Hut](https://github.com/SE2-Polito/AY26-27-Mountain-Hut). Questions about what a story means go there, as issues. This repository holds our code, our tasks and our bugs.

## Licence

This project is licensed under the [European Union Public Licence v1.2 (EUPL-1.2)](LICENCE).

**Why EUPL-1.2**

We do not accept the reuse of our code in proprietary products. Anyone who distributes a modified version of our code must share its source code, and this also applies when the modified version is offered as an online service. Our software must be able to adopt the licences of the libraries we use, and EUPL-1.2 is compatible with the main ones (GPL, AGPL, LGPL, MPL and others). If a larger program uses our software as an unmodified component, only our part has to adopt our licence, not the whole program.

## Repository structure

```text
.github/             workflows, branch rulesets, Pull Request and issue templates
client/              the web client: React, built with Vite
docs/                the architecture, the API contract, the mockups, the e2e definitions and the manual test reports
e2e/                 end-to-end tests: Playwright, with the real client and server
retrospective_docs/  the retrospective of each sprint
server/              the API: Node.js and Express
LICENCE              the text of the EUPL-1.2
```

The code is organised in layers, in `server/src` and in `client/src`: see [docs/architecture.md](docs/architecture.md). Every layer folder has an `example.js` (or `example.jsx`) whose header says what the layer contains and what it must not contain. In the server it also has a small example on the Mountain Hut stories. ESLint enforces who may import whom, so `npm run lint` fails on a layer that reaches too far. The examples are deleted as the real files take their place.

## Requirements

- **Node.js 22** (`nvm use` reads `.nvmrc`)
- **PostgreSQL 16**, running on your computer

## Getting started

Set up the server once (the configuration and the database are explained below):

```bash
cd server
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
# edit .env: put the URL of your PostgreSQL in DATABASE_URL and TEST_DATABASE_URL
npm run db:create         # creates the empty database
npm run db:migrate        # creates the tables
npm run db:seed           # creates the demo accounts
```

Start the server:

```bash
cd server
npm start                 # http://localhost:3001
```

Start the client, in another terminal:

```bash
cd client
npm install
npm run dev               # http://localhost:5173, it forwards /api to the server
```

In `server`, `npm run dev` restarts the server when a file changes.

### Configuration

The server reads all its settings in one place, `server/src/config.js`. A setting comes from the environment (for example the run configuration of your IDE, CI or Docker) or from `server/.env`. If both give it, the environment wins.

`server/.env` is personal and is never committed. Copy [`server/.env.example`](server/.env.example) to `server/.env` and edit it.

| Variable | Default | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | none, required | The PostgreSQL database of the server and of the `db:*` scripts, for example `postgresql://postgres:postgres@localhost:5432/mountain_hut`. |
| `TEST_DATABASE_URL` | none, required for the tests that use the database | The database of the server tests. It must be a different database: the tests delete data. |
| `PORT` | `3001` | The port of the server. |
| `SESSION_TTL_HOURS` | `24` | How long a login session lasts. |
| `COOKIE_SECURE` | `false` | Set to `true` when the site is served over HTTPS, so the session cookie is sent only on HTTPS. |
| `SMTP_HOST` | none | The email service. Without it no email is sent: the server only writes it to the log. |
| `SMTP_PORT` | `587` | The port of the email service. |
| `SMTP_USER`, `SMTP_PASSWORD` | none | The login of the email service, if it asks for one. |
| `MAIL_FROM` | `QUOTA <no-reply@quota.example>` | The sender of the emails. |
| `CLIENT_DIR` | none | The folder of the built client, which the server then serves too. The Docker image sets it. |

When `NODE_ENV` is `test` (vitest sets it by itself) the server code uses `TEST_DATABASE_URL` instead of `DATABASE_URL`, so a test never touches your data.

### Database

The tables are created by the SQL files in `server/migrations`, applied in the order of their names (`000_...`, `001_...`). A file already applied is skipped, so changing it does not change a database that already has it: start again with `npm run db:reset`, or add a new file.

Run these commands in `server`. They use the database of `DATABASE_URL`:

| Command | What it does |
|---|---|
| `npm run db:create` | Creates the empty database, if it does not exist. The user of the URL needs the permission to create databases. |
| `npm run db:migrate` | Applies the migrations not applied yet. Safe to run again. |
| `npm run db:seed` | Creates the demo accounts below, the demo tables and the demo slots. Safe to run again. |
| `npm run db:drop` | Deletes every table and all the data, and leaves the database empty. It refuses to run when `NODE_ENV` is `production`. |
| `npm run db:reset` | `db:drop` and then `db:migrate`: the tables are created again from the migrations. Run `db:seed` after it. |

#### Demo accounts

`db:seed` creates one warden, two employees and one hiker. Other hikers can sign up from the application.

| Role | Name | Email | Password |
|---|---|---|---|
| Warden | Emily Parker | `emily.parker@quota.example` | `quota-demo-2026` |
| Employee | James Taylor | `james.taylor@quota.example` | `quota-demo-2026` |
| Employee | Oliver Wilson | `oliver.wilson@quota.example` | `quota-demo-2026` |
| Hiker | Lucas Bennett | `lucas.bennett@quota.example` | `quota-demo-2026` |

This password is public: use the seed only for development and demos, never on a real deployment.

## Run with Docker

The whole app runs on a machine that has only Docker. From the root of the repository:

```bash
docker compose up --build
```

Open http://localhost:3001. The first start takes a few minutes, because it builds the image. The migrations run by themselves every time the app starts.

To add the demo accounts and slots, with the app running, in another terminal:

```bash
docker compose exec app node scripts/seed.js
```

The password of the database is `postgres`. To use another one, set `POSTGRES_PASSWORD` before the first start, with any characters: it does not go in a URL, so nothing needs encoding. PostgreSQL reads it only when it creates the data, so to change it later use `docker compose down -v` first, which deletes the data.

Emails do not leave your machine: **Mailpit** keeps them, and you can read them on http://localhost:8025. See [Emails](#emails).

`docker compose down` stops the app and keeps the data. `docker compose down -v` also deletes the data. If port 3001 is taken, start it with `PORT=8080 docker compose up --build`.

## Emails

The app sends one email: the **booking confirmation**, to the hiker who booked a table (MH-03). It leaves right after the booking is saved. If the email cannot be sent, the booking still stands; the error is only written to the server log.

During development no email reaches a real inbox. The demo accounts use `@quota.example` addresses, which do not exist, so the emails are caught on your machine:

- **With Docker**, `docker compose up` also starts **Mailpit**, a local email inbox. The app sends every email to it (`SMTP_HOST=mailpit`, port `1025`). Open **http://localhost:8025** to read them: each email shows its recipient, subject and content, whatever address it was sent to. If port 8025 is taken, start with `MAILPIT_PORT=8026 docker compose up --build` and open that port.
- **Without Docker** (`npm run dev`), when `SMTP_HOST` is not set nothing is sent: the server writes the email (recipient, subject and text) to its terminal. To see it as a real email, start Mailpit alone and point the server to it:

  ```bash
  docker run --rm -p 1025:1025 -p 8025:8025 axllent/mailpit:v1.29
  ```

  Then set `SMTP_HOST=localhost` and `SMTP_PORT=1025` in `server/.env`, restart the server and open http://localhost:8025.

To try it: log in as the demo hiker (`lucas.bennett@quota.example`), book a table, then open Mailpit. The confirmation is there, with the booking code (for example `QUOTA-00004`), the date, the time and the number of people.

To send real emails, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM` (see [Configuration](#configuration)) for an email service you own, and book with an account whose address is a real inbox. Never commit these values.

## Tests

| What | Where | How |
|---|---|---|
| Server | `server/test`, one folder per layer | `npm test` in `server` |
| Client unit tests | `client/test`, pure search, selection, URL and message rules | `npm test` in `client` (Node's built-in runner, no browser or database) |
| End to end | `e2e/tests` | `npm run e2e` in `e2e` |

Use a dedicated migrated `E2E_DATABASE_URL`, not a database with manual test data.
In `e2e/tests/mh-2-define-tables-and-slots.spec.js`, `newDay()` chooses fixture dates,
the tests count slots on those dates, and `cleanup()` deletes every slot on them.
Existing manual data could therefore affect the assertions or be deleted by that cleanup.

The server tests that use PostgreSQL connect to `TEST_DATABASE_URL`, so set it in `server/.env`. Create that database once, and then run the tests: the tests apply the migrations by themselves, so there is no need for `db:migrate`.

```powershell
cd server
$env:NODE_ENV = "test"; npm run db:create; Remove-Item Env:NODE_ENV   # once; in bash: NODE_ENV=test npm run db:create
npm test
```

To start the test database again from zero: `NODE_ENV=test npm run db:reset` (PowerShell: set `$env:NODE_ENV` as above).

Do not point `TEST_DATABASE_URL` at a database containing data you need to keep.

The E2E tests start the server and the client by themselves. The server uses `E2E_DATABASE_URL` when it is set, and `DATABASE_URL` otherwise. The first time, install everything and the browser:

```bash
cd server && npm install && cd ..
cd client && npm install && cd ..
cd e2e && npm install && npx playwright install chromium
```

Then, from the `e2e` directory, run `npm run e2e`. Ports 3001 and 5173 must be free, so stop your own server and client first. To see the report of the last run, use `npx playwright show-report`.

The tests of the confirmation email (MH-3) read the emails from [Mailpit](https://mailpit.axllent.org), and are skipped without it. To run them, start Mailpit and give the server and the tests its addresses:

```bash
docker run -d --rm --name mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit:v1.29
SMTP_HOST=localhost SMTP_PORT=1025 MAILPIT_URL=http://localhost:8025 npm run e2e
```

Lint: `npm run lint`, in `server` and in `client`.

## Feedback and bugs

Open an issue from the **Issues** tab and choose a form:

- **[Review](../../issues/new?template=review.yml)**: a change you propose after our demo. Always the same parts: the story or screen, what you saw, what should change, and why.
- **[Bug](../../issues/new?template=bug.yml)**: something does not work as the story says.

Questions about what a user story means go to the shared requirements repository, not here.

## Branching strategy

The project follows a three-stage branching strategy:

```text
feature/* → dev → qa → main
```

### `main`

Contains the stable and reviewed version of the project.

Changes can only be merged into `main` through a Pull Request from `qa`.

At least **one approval** is required before merging.

### `qa`

Used for testing, integration, and code review before changes reach `main`.

`qa` tests **one batch at a time**. Changes reach `qa` in two ways:

- **A new batch** comes through a Pull Request from `dev`. It can be opened only when everything already in `qa` has been promoted to `main` (the **Qa is promoted to main** check) and `dev` already contains every fix made on `qa` (the **Dev has everything from qa** check).
- **A change to the batch already in `qa`** (a test, or the fix of a bug the tests found) comes through a Pull Request from a `fix/*` or `test/*` branch created from `qa`. See [Testing](#where-a-test-is-written).

### `dev`

Main development and integration branch.

New features and fixes should be developed in dedicated branches created from `dev`.

Examples:

```text
feature/login
feature/book-table
fix/authentication
chore/branch-flow
```

Once the work is complete, a Pull Request should be opened toward `dev`. The branch must contain the current `dev` (the **Branch is up to date with dev** check): if `dev` moved, bring it in with **Update branch** on the Pull Request.

## Development workflow

1. Update the local `dev` branch:

```bash
git checkout dev
git pull origin dev
```

2. Create a new branch:

```bash
git checkout -b feature/feature-name
```

3. Develop and commit the changes:

```bash
git add .
git commit -m "feat: description of the change"
```

4. Push the branch:

```bash
git push -u origin feature/feature-name
```

5. Open a Pull Request:

```text
feature/* → dev
```

6. When the development version is ready for testing, and `qa` has no batch waiting for `main`:

```text
dev → qa
```

7. After testing and review:

```text
qa → main
```

## Where a test is written

Tests are written in `qa`, not in the feature branches: other people test the batch, so they are the ones who write the tests. A Pull Request into `dev` carries the code only.

On `qa`, for a test or for the fix of a bug the tests found:

1. Create a branch **from `qa`**, named `test/...` (a test) or `fix/...` (a fix):

```bash
git checkout qa
git pull origin qa
git checkout -b test/short-description
```

2. Open a Pull Request **into `qa`** and merge it.
3. Open a Pull Request from `qa` into `dev` (back-merge), so that `dev` receives the same change. Merge it with **Create a merge commit**, not squash or rebase: the **Dev has everything from qa** check recognizes the fix only that way, and it stays red until the back-merge is done.
4. When `qa` is verified, promote it: `qa → main`.

Only then the next batch can move on: `dev → qa`.

## Branch protection

Protected branches:

- `main`
- `qa`
- `dev`

Direct pushes and force pushes to protected branches are restricted. Pull Requests are used to integrate changes and maintain a controlled development workflow.

The rules are kept as code in [`.github/rulesets`](.github/rulesets), to be imported in the repository settings (Settings → Rules → Rulesets → Import a ruleset), and the flow is checked by the [`branch-flow.yml`](.github/workflows/branch-flow.yml) workflow.

The expected promotion flow is:

```text
feature/*
    │
    ▼
   dev
    │
    ▼
   qa
    │
    ▼
  main
```

## Pipelines

The workflows are in [`.github/workflows`](.github/workflows).

| Workflow | When it runs | What it does |
|---|---|---|
| `branch-flow.yml` | every Pull Request into `dev`, `qa` or `main` | Checks the branch flow |
| `ci.yml` | every Pull Request into `dev`, `qa` or `main` | **Server: lint and tests** and **Client: lint and build**; for a Pull Request into `qa` or `main`, also **E2E tests** |
| `integration.yml`, `qa.yml`, `deploy.yml` | push to `dev`, `qa`, `main` | The checks of `ci.yml` again on the merged result (the E2E tests too on `qa` and `main`); `qa.yml` and `deploy.yml` also publish the Docker image, tagged `qa` and `latest`, and `deploy.yml` builds the client |

To run the same checks on your computer: `npm run lint` and `npm test` in `server`, `npm run lint`, `npm test` and `npm run build` in `client`, and `npm run e2e` in `e2e`.

## Commit convention

Use short and descriptive commit messages.

Recommended prefixes:

```text
feat:     new feature
fix:      bug fix
docs:     documentation changes
test:     tests
refactor: code refactoring
chore:    repository or maintenance changes
ci:       CI/CD configuration changes
```

Examples:

```text
feat: add table booking
fix: handle invalid login credentials
docs: update README
ci: enforce branch flow
```
