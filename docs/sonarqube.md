# SonarQube

We analyse the code with SonarQube Cloud. It is an extra look on the code, not a gate: no ruleset requires it and the workflow does not fail when the quality gate does, so a bad result does not block a merge.

## Choices

**What is analysed.** `server/src` and `client/src`, as code. The tests (`*.test.js` and `*.spec.js` in `server/test`, `client/test` and `e2e/tests`) are marked as tests. Everything else is left out: `docs/`, `server/scripts`, `server/migrations`, the workflows (`.github/`), the Docker files and the configuration files. We analyse the code we write and maintain; documents and tools are not code, and `seed.js` has a public demo password that the scanner would report.

**Which branch.** `qa` only. The free plan analyses one branch and the Pull Requests into it. `qa` receives each batch as a whole and the tests of the batch are written there, so the coverage is complete. `dev` and `main` are not analysed.

**How.** With the workflow [`sonarqube.yml`](../.github/workflows/sonarqube.yml), not with the automatic analysis of SonarQube Cloud: the automatic one has no coverage and cannot run together with the workflow. The workflow needs the secret `SONAR_TOKEN`.
