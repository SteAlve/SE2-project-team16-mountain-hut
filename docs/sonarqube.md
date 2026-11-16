# Code analysis with SonarQube

We send the code to SonarQube Cloud (organization `stealve`, project `SteAlve_SE2-project-team16-mountain-hut`). It looks for bugs, security problems, code that is hard to maintain and duplicated code, and it shows how much of the server code the tests run. It tells us about a Pull Request before it merges.

It is an extra look, not a gate. No ruleset requires it (see [the pipelines](architecture.md#7-cicd-pipelines)), so a bad result does not block a merge by itself: the people who review the Pull Request decide what to do with it.

## What is analysed and what is not

SonarQube looks only at the folders we list in [`sonar-project.properties`](../sonar-project.properties). Everything else is ignored: the files at the root of the repository, the configuration files (`eslint.config.js`, `vite.config.js`, `vitest.config.js`, `playwright.config.js`, `package.json`, ...) and the helpers inside the test folders (fixtures, the test SMTP server).

| Path | How SonarQube sees it | Why |
|---|---|---|
| `server/src` | code, with coverage | The rules of the hut, the sessions, the passwords and the database access: where a mistake costs the most. |
| `client/src` | code, without coverage | The web client (React and CSS). The client has no coverage report yet, so it is left out of the coverage instead of counting as not covered. |
| `server/test`, `client/test`, `e2e/tests` | tests | Only the files `*.test.js` and `*.spec.js`. They are not judged as code and not counted in the coverage. |
| `server/scripts` | not analysed | The tools that create, migrate and seed the database. `seed.js` holds the demo password that the README publishes, which the scanner would report as a password in the code. |
| `server/migrations` | not analysed | The SQL of the schema: little to gain. |
| `docs/`, `retrospective_docs/` | not analysed | Documents, mockups, images and the API contract: not code. The HTML of the mockups would only add noise. |
| `.github/`, `Dockerfile`, `docker-compose.yml` | not analysed | SonarQube has rules for Docker files and workflows, but we kept the first results about the code. They can be added (see [Changing what is analysed](#changing-what-is-analysed)). |
| `node_modules`, `dist`, `coverage` | excluded | Installed or generated files, in any folder. |

**Coverage.** It comes from the server tests only. Vitest measures every module of `server/src` (`coverage.include` in `server/vitest.config.js`), so a module that no test loads counts as 0% and cannot hide. The tests themselves, the client and the end-to-end tests are listed in `sonar.coverage.exclusions`.

## When it runs

The free plan of SonarQube Cloud analyses **one** long-lived branch, the main branch of the Sonar project, and only the Pull Requests that target it. Other branches, and Pull Requests into them, need a paid plan. We chose `qa`, for two reasons:

- the tests of a batch are written on `qa` (see [the pipelines](architecture.md#7-cicd-pipelines)), so the coverage is complete only there;
- the batch enters `qa` as a whole, with the Pull Request `dev → qa`, so SonarQube judges everything that is about to be promoted.

It is a setting of SonarQube Cloud: the default branch of the repository on GitHub is still `main`.

| What happens | Analysed |
|---|---|
| Pull Request into `qa` (the batch from `dev`, and the `fix/*` and `test/*` branches) | yes, and only the code that the Pull Request changes is judged: for `dev → qa`, the whole batch |
| push to `qa` | yes: it is the reference that the Pull Requests are compared with |
| Pull Request into `dev` or `main`, push to `dev` or `main` | no |

So a feature is not analysed when it enters `dev`: it is analysed with its batch when the batch enters `qa`. The fixes and the tests made on `qa` are analysed too. `main` gets what was analysed on `qa`. A Pull Request from a fork would not see the secret and would not be analysed; ours come from branches of this repository.

## How the workflow works

[`sonarqube.yml`](../.github/workflows/sonarqube.yml), job `Build and analyze`:

1. It checks out the whole history (a shallow clone gives a worse analysis of what changed).
2. It installs Node.js (the version of `.nvmrc`) and the dependencies of the server.
3. It applies the migrations and runs the server tests with coverage in the `lcov` format, against a PostgreSQL service, as `ci.yml` does.
4. It writes `server/` in front of the paths of the coverage file, because it has `src/app.js` and SonarQube needs `server/src/app.js` from the root of the repository.
5. It runs the scan, with the token in the secret `SONAR_TOKEN`.

It only sends the analysis. It does not wait for the verdict of the quality gate (the conditions a Pull Request must meet): the verdict is on the project page of SonarQube Cloud and, when the GitHub integration of SonarQube Cloud is on, on the Pull Request. The quality gate is the one the project has in SonarQube Cloud, not a custom one.

## One-time setup

Done once by an administrator of the project, in this order:

1. In SonarQube Cloud, **turn off the automatic analysis** of the project. It does not run the tests, so it has no coverage, and it cannot work together with the analysis of the workflow.
2. **Rename the main branch of the project to `qa`** (page Branches). It does not change anything on GitHub. Do it before the first analysis.
3. On GitHub, add the secret **`SONAR_TOKEN`** (Settings, Secrets and variables, Actions), with a token generated in SonarQube Cloud.
4. Merge the workflow into `dev`; it reaches `qa` with the next promotion. The Pull Request `dev → qa` is the first analysis and has nothing to be compared with; the push to `qa` that follows creates the reference, and after that every Pull Request into `qa` is compared with it.

## Changing what is analysed

| I want to | Change |
|---|---|
| analyse another folder | add it to `sonar.sources` in `sonar-project.properties` |
| stop analysing a path that is not code we maintain | add it to `sonar.exclusions` |
| count the client in the coverage | produce a coverage report of the client in the workflow, add it to `sonar.javascript.lcov.reportPaths` and remove `client/**` from `sonar.coverage.exclusions` |
| analyse the workflows and the Docker files | add `.github`, `Dockerfile` and `docker-compose.yml` to `sonar.sources` |
| analyse `dev` and `main` too | needs a paid plan of SonarQube Cloud; then add the branches to `on.push.branches` and `on.pull_request.branches` of the workflow |

Rules we follow:

- **Analyse the code we write and maintain**; leave out documents, generated files and tools.
- **Do not exclude real code to raise the coverage.** Exclude from the coverage only what makes no sense to test.
- **A result we do not agree with is not a reason to exclude a file.** It is marked in SonarQube Cloud (false positive, or accepted) with a comment that says why.

## Not decided yet

- Making the analysis a required check, or making the workflow fail when the quality gate fails.
- A coverage report of the client.
- Analysing the workflows and the Docker files.

## References

- [Subscription plans of SonarQube Cloud](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans)
- [Branch analysis](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/branch-analysis/branch-analysis)
- [Pull request analysis](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/pull-request-analysis)
- [Automatic analysis](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/automatic-analysis)
