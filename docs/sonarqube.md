# SonarQube

We analyse the code with SonarQube Cloud. It is an extra look on the code, not a gate: no ruleset requires it and the workflow does not fail when the quality gate does, so a bad result does not block a merge.

## Choices

**What is analysed.** `server/src` and `client/src`, as code. SonarQube Cloud analyses the whole project and no longer reads `sonar.sources` or `sonar.tests`, so what is not product code is left out with `sonar.exclusions` in `sonar-project.properties`: the tests (they are not analysed), `docs/`, `server/scripts`, `server/migrations`, the workflows (`.github/`), the Docker files, the configuration files and the mock server of the client (`client/src/api/mockServer.js`), a fake backend used only in development. We analyse the code we write and maintain; documents and tools are not code, and `seed.js` has a public demo password that the scanner would report.

**Which branch.** `qa` only. The free plan analyses one branch and the Pull Requests into it. `qa` receives each batch as a whole and the tests of the batch are written there, so the coverage is complete. `dev` and `main` are not analysed.

**How.** With the workflow [`sonarqube.yml`](../.github/workflows/sonarqube.yml), not with the automatic analysis of SonarQube Cloud: the automatic one has no coverage and cannot run together with the workflow. The workflow needs the secret `SONAR_TOKEN`.
