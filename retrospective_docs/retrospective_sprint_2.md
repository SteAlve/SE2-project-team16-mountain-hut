# Retrospective — Sprint 2 (Team 16)

## PROCESS MEASURES

### Macro statistics

- Number of stories committed vs done: **TBD / TBD**
- Total points committed vs done: **TBD / TBD**
- Number of hours planned vs spent as a team: **TBD / TBD**
  - Initial planning baseline: **96 hours**
  - The final plan was higher than the initial 96-hour estimate; the exact value should be confirmed from the task tracker.

**Definition of Done for this sprint**

A story is considered done only when it satisfies the following:

- Backend automated tests achieve at least **80% coverage**.
- Code review is completed.
- Code is present on the version-control system.
- End-to-end tests are performed according to the story requirements.
- Frontend manual tests are documented in a written report for every test performed.

### Detailed statistics

| Story | # Tasks | Points | Hours est. | Hours actual |
|-------|---------:|-------:|-----------:|--------------:|
| _Story data to be completed_ | | | | |
| **Total** | | | | |

The detailed task statistics, including hours per person and the total estimation error ratio, should be completed from the task tracker before the retrospective is finalized.

## QUALITY MEASURES

- Unit testing:
  - Total hours estimated: **TBD**
  - Total hours spent: **TBD**
  - Number of automated test cases: **TBD**
  - Coverage: Backend coverage must be at least **80%**; measured result: **TBD**
- Integration testing:
  - Total hours estimated: **TBD**
  - Total hours spent: **TBD**
- E2E testing:
  - Total hours estimated: **TBD**
  - Total hours spent: **TBD**
- Code review:
  - Total hours estimated: **TBD**
  - Total hours spent: **TBD**
- Manual frontend testing:
  - A written report is required for each manual test.
  - Number of tests/reports completed: **TBD**

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
