## What changes

<!-- One or two sentences: what this Pull Request does and why.
     For a new batch (dev → qa) or a promotion (qa → main): the stories it brings. -->

## Stories and tasks

<!-- The story IDs (e.g. MH-04) and the issues it closes (e.g. Closes #12). -->

## How to check it

<!-- The steps to try it.
     dev → qa: what QA should try.
     qa → main: how QA went and the known problems. -->

## Checklist

- [ ] The base branch is the right one: `dev` for new work, `qa` for a new batch (from `dev`) or for `fix/*` and `test/*`, `main` only from `qa`
- [ ] Lint and the existing tests pass
- [ ] The documentation is updated if the behaviour or the architecture changed
- [ ] `qa → dev` only: it will be merged with **Create a merge commit**, not squash or rebase
