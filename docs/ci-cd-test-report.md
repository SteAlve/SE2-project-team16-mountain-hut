# CI/CD test report

The goal of the test is to check that the pipelines of [`.github/workflows`](../.github/workflows) do what [the architecture](architecture.md#7-cicd-pipelines) says: a fault turns red the check that is meant to catch it, and nothing else, and the workflows that run after a push work on the merged result.

## How it was tested

- **One fault, one Pull Request.** Seven draft Pull Requests, each from a branch with a single deliberate fault. The Pull Requests were closed without merging and their branches deleted, but they stay visible on GitHub as evidence (#16 to #22).
- **The state of the repository during the test:**
  - the workflows were on `dev`, `qa` and `main`;
  - the rulesets required only the checks of `branch-flow.yml` (`Protect main`: **Validate branch flow** and 1 approval; `Protect qa`: **Validate branch flow**, **Qa is promoted to main**, **Dev has everything from qa**; `Protect dev`: **Branch is up to date with dev**);
  - the repository admin could bypass the rulesets;
  - merge commits, squash and rebase were all allowed.

## Scenarios on a Pull Request

| # | Scenario | Fault | Expected | Result | Evidence |
|---|---|---|---|---|---|
| 1 | The lint of the server fails | `==` instead of `===` in a new file of `server/src` | **Server: lint and tests** red | Red at the step *Run lint* (`eqeqeq`); the client check stays green | [#16](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/16), [run](https://github.com/SteAlve/SE2-project-team16-mountain-hut/actions/runs/40724160386) |
| 2 | A test of the server fails | `expect(1 + 1).toBe(3)` | **Server: lint and tests** red | Red at the step *Run tests*; the lint step passes | [#17](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/17), [run](https://github.com/SteAlve/SE2-project-team16-mountain-hut/actions/runs/40724164899) |
| 3 | The lint of the client fails | a component that calls `fetch` (the layer rule) | **Client: lint and build** red | Red at the step *Run lint* (`Only api/ talks to the server`); the server check stays green | [#18](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/18), [run](https://github.com/SteAlve/SE2-project-team16-mountain-hut/actions/runs/40724172987) |
| 4 | The build of the client fails | an `import` of a file that does not exist | **Client: lint and build** red, at the build only | Red at the step *Build*; the lint step passes | [#19](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/19), [run](https://github.com/SteAlve/SE2-project-team16-mountain-hut/actions/runs/40724179499) |
| 5 | An E2E test fails, on a Pull Request into `qa` | a Playwright test that expects a wrong title | **E2E tests** red and the report kept | Red at the step *Run the E2E tests* (expected `This title does not exist`, received `Mountain Hut`); the artifact `playwright-report` (634,664 bytes, 7 days) is uploaded; server and client stay green | [#20](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/20), [run](https://github.com/SteAlve/SE2-project-team16-mountain-hut/actions/runs/40724185449) |
| 6 | A branch that is not `qa` into `main` | a Pull Request from a branch of `dev` into `main` | **Validate branch flow** red | Red; the merge state is `BLOCKED`. **E2E tests** also ran on this Pull Request into `main` and passed | [#21](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/21) |
| 7 | A branch behind `dev` | a branch cut 3 commits before `dev` (18 commits behind) | **Branch is up to date with dev** red | Red; the merge state is `BLOCKED` | [#22](https://github.com/SteAlve/SE2-project-team16-mountain-hut/pull/22) |
| 8 | Two pushes one after the other | a second push to the branch of #16 one second after the first | the run in progress is cancelled | The run of the first commit (`82a5092`) is *cancelled*, the run of the second (`8597360`) ran to its end | [cancelled run](https://github.com/SteAlve/SE2-project-team16-mountain-hut/actions/runs/40724156643), [run that ran](https://github.com/SteAlve/SE2-project-team16-mountain-hut/actions/runs/40724160386) |
| 9 | The E2E tests do not run on `dev` | the Pull Requests into `dev` of scenarios 1 to 4 and 7 | **E2E tests** skipped | Skipped on all of them | #16 to #19, #22 |
| 10 | The checks of the promotion are skipped elsewhere | the same Pull Requests | **Qa is promoted to main** and **Dev has everything from qa** skipped | Skipped, as they are meant only for `dev → qa` | #16 to #22 |

Time of the jobs on GitHub: server (with the PostgreSQL container) 25 to 32 seconds, client 10 to 15 seconds, E2E 48 to 53 seconds.

## Workflows after a push

Evidence from the real runs, not from test Pull Requests.

| Workflow | Branch | Result | Evidence |
|---|---|---|---|
| **Integration** | `dev` | Success on every push to `dev` (4 runs). Server and client green, E2E skipped | [latest run](https://github.com/SteAlve/SE2-project-team16-mountain-hut/actions/runs/40674402093) |
| **QA** | `qa` | Success; the three jobs ran, E2E included | [run](https://github.com/SteAlve/SE2-project-team16-mountain-hut/actions/runs/40496724504) |
| **Deploy** | `main` | Success: the three checks (E2E included), then **Build the client** and **Deploy**. The artifact `client-dist` (81,686 bytes, 30 days) is kept, and the job **Deploy** prints the notice `No deployment target yet` | [run](https://github.com/SteAlve/SE2-project-team16-mountain-hut/actions/runs/40522887574) |

## Findings

- **The gates work as designed.** Every fault turned red the intended check, at the intended step, and the other jobs of the same run stayed green.
- **A red CI check does not block the merge yet.** In scenarios 1 to 5 the merge state is `UNSTABLE` and not `BLOCKED`, because the rulesets require only the checks of `branch-flow.yml`. Only scenarios 6 and 7, which fail a required check, are `BLOCKED`. The test Pull Requests were drafts, so they could not be merged anyway.
- **The repository admin can bypass the rulesets** (role *Repository admin*, always), by choice.
- **Squash and rebase were allowed during the test, and have been removed since.** The repository now allows only merge commits, which the checks of `branch-flow.yml` need.
- **The runner image is changing.** A run showed the notice that the label `ubuntu-latest` migrates to Ubuntu 26 from 19 October 2026. The E2E job installs the browser with `--with-deps`; if the new image breaks it, the label can be fixed to `ubuntu-24.04`.

## Result

All the scenarios behaved as expected and the workflows after a push work on `dev`, `qa` and `main`.

One point is open and is not part of this test: the CI checks are not required by the rulesets yet. The names to require are **Server: lint and tests** and **Client: lint and build** on `dev`, `qa` and `main`, and **E2E tests** on `qa` and `main`. After that, scenarios 1 to 5 should be repeated to confirm that the merge state becomes `BLOCKED`.
