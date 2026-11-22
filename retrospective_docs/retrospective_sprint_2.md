# Retrospective — Sprint 2 (Team 16)

## PROCESS MEASURES

### Macro statistics

- Number of stories committed vs done: **4 / 4**
- Total points committed vs done: **16 / 16**
- Nr of hours planned vs spent (as a team): **96h 30m** / **97h 35m**

**Remember**  a story is done ONLY if it fits the Definition of Done:

- Unit Tests passing
- Code review completed
- Code present on VCS
- End-to-End tests performed
- backend: 80% coverage on sonarqube
- frontend: written report for manual tests

### Detailed statistics

| Story                          | # Tasks      | Points       | Hours est.        | Hours actual      |
| ------------------------------ | ------------ | ------------ | ----------------- | ----------------- |
| #0 - Uncategorized             | 12           | -            | 32h 50m           | 31h 00m           |
| MH-05                          | 12           | 2            | 13h 30m           | 14h 05m           |
| MH-06                          | 14           | 3            | 16h 30m           | 17h 10m           |
| MH-07                          | 17           | 8            | 27h 40m           | 26h 47m           |
| MH-08                          | 9            | 3            | 6h 00m            | 7h 05m            |
| MH-09 (partial, not committed) | 2            | -            | 1h 40m            | 1h 28m            |
| **Total**                | **66** | **16** | **98h 10m** | **97h 35m** |

- Hours per task per person: average **0.849 hours** (about 51 minutes), standard deviation **0.710 hours** (about 43 minutes).
- Total task estimation error ratio: **-0.59%** (97h 35m / 98h 10m - 1)

## QUALITY MEASURES

- Unit Testing:
  - Total hours estimated: **2h 30m**
  - Total hours spent: **2h 30m**
  - Nr of automated unit test cases: **329**
  - Coverage: **97.52% lines, 97.55% statements, 95.2% branches, 98.61% functions**
- Integration testing:
  - Total hours estimated: **4h 20m**
  - Total hours spent: **4h 00m**
- E2E testing:
  - Total hours estimated: **6h 30m**
  - Total hours spent: **8h 55m**
- Code review:
  - Total hours estimated: **14h 30m**
  - Total hours spent: **13h 30m**

### UI and mockup discussion

The UI should be reviewed as a team before implementation begins. The review should confirm the main user flow, navigation, states for loading/empty/error cases, validation messages, and the expected behavior on the target screen sizes. Decisions and unresolved questions should be recorded with the story. Mockup creation and review need their own time estimate because ambiguity in the mockup is likely to reappear as frontend rework or as inconsistent manual-test results.

### Manual testing procedure

Manual testing should be risk-based and use the same procedure for each story:

1. **Before E2E testing:** perform a short exploratory test intended to break the feature. Check invalid input, boundary cases, unexpected navigation, missing data, loading/error states, and visible UI problems. Record each finding with steps to reproduce, expected result, actual result, severity, and evidence where useful.
2. **After E2E testing:** use the feature normally, following the main acceptance scenario from start to finish. Confirm that the user flow is understandable and that the final UI behavior matches the mockup and story requirements. Record the result, including any deviations.

Manual testing is required when the behavior depends on visual layout, user interaction, navigation, device/browser behavior, or an end-to-end workflow that automated tests cannot adequately verify. It should be reduced or skipped when the check is fully deterministic and already covered by reliable automated tests, when the build is not stable enough to produce meaningful results, or when the same check would simply duplicate an existing report. In a time-constrained sprint, prioritize critical user journeys, newly changed areas, and high-risk failure cases, and document which lower-risk checks were deferred.

## ASSESSMENT

### What caused errors in estimation?

- Implementation time was overestimated in some cases because parts of development were faster than expected. Estimates should account for the actual implementation effort while still reserving enough time for validation and review.
- Mockups, mockup discussions, and mockup reviews required more time than estimated.
- Manual testing was underestimated because the team had not agreed in advance on uniform criteria, scope, or reporting requirements.
- Code review and bug-fixing time need to be estimated explicitly rather than treated as leftover capacity.

### What lessons did we learn in this sprint?

- The process of serializing the work inside each story—mockup, backend, frontend, and testing—while parallelizing separate stories worked well and should be retained.
- Manual testing is more consistent and less time-consuming when the team agrees beforehand on what is required, what evidence is recorded, and which checks are covered by automation.
- E2E requirements should be reviewed at the start of the story, not only when testing begins.
- Implementation estimates can be reduced when development work is expected to be faster, but testing, review, integration, and debugging estimates should increase or be protected.

### Which improvement goals from the previous retrospective were achieved?

The current story workflow worked well: work inside a story was kept in a clear sequence, while independent stories were developed in parallel. This allowed the team to use parallel capacity without losing the order needed within each story.

The team also identified and clarified a more deliberate manual-testing approach: exploratory testing before E2E testing and normal-use testing after E2E testing.

All improvement goals from the previous retrospective were achieved.

### Improvement goals for the next sprint and how to achieve them

- **Make estimation risk-based and complete.**
  - Estimate each story separately according to its mockup complexity, backend/frontend work, testing needs, review effort, and expected bug-fixing effort.
  - Reduce implementation estimates where development is expected to be faster, but explicitly reserve time for testing, code review, integration, and corrections.

- **Consider allocating a small portion of time to team management.**

### One thing we are proud of as a team

We are proud that our workflow of sequencing tasks within each story and parallelizing independent stories worked well. It gave the team a practical balance between coordination and parallel development, and it provides a strong basis for improving estimation and quality practices in the next sprint.
