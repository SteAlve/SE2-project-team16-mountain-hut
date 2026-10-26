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
docs/                the architecture documents
e2e/                 end-to-end tests: Playwright, with the real client and server
retrospective_docs/  the retrospective of each sprint
server/              the API: Node.js and Express
LICENCE              the text of the EUPL-1.2
```

The code is organised in layers, in `server/src` and in `client/src`: see [docs/architecture.md](docs/architecture.md). Every layer folder has an `example.js` (or `example.jsx`) whose header says what the layer contains and what it must not contain. In the server it also has a small example on the Mountain Hut stories. ESLint enforces who may import whom, so `npm run lint` fails on a layer that reaches too far. The examples are deleted as the real files take their place.

The database is set up in its own task: until then `server/src/dao/db.js` is a placeholder, and its header says what the rest of the code expects from it.

## Requirements

- **Node.js 22** (`nvm use` reads `.nvmrc`)

## Getting started

Start the server:

```bash
cd server
npm install
npm start                 # http://localhost:3001
```

Start the client, in another terminal:

```bash
cd client
npm install
npm run dev               # http://localhost:5173, it forwards /api to the server
```

In `server`, `npm run dev` restarts the server when a file changes.

## Tests

| What | Where | How |
|---|---|---|
| Server | `server/test`, one folder per layer | `npm test` in `server` |
| End to end | `e2e/tests` | `npm run e2e` in `e2e` |

The E2E tests start the server and the client by themselves. The first time, install everything and the browser:

```bash
cd server && npm install && cd ..
cd client && npm install && cd ..
cd e2e && npm install && npx playwright install chromium
```

Then, from the `e2e` directory, run `npm run e2e`. Ports 3001 and 5173 must be free, so stop your own server and client first. To see the report of the last run, use `npx playwright show-report`.

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
