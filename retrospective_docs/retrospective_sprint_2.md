# Retrospective — Sprint 2 (Team 16)

## PROCESS MEASURES

### Macro statistics

- Number of stories committed vs done: **4 / 4**
- Total points committed vs done: **16 / 16**
- Nr of hours planned vs spent (as a team): **98h 10m** / **97h 40m**

**Remember**  a story is done ONLY if it fits the Definition of Done:

- Unit Tests passing
- Code review completed
- Code present on VCS
- End-to-End tests performed
- backend: more than 80% coverage on SonarQube
- frontend: written report for manual tests

### Detailed statistics

| Story                          | # Tasks      | Points       | Hours est.        | Hours actual      |
| ------------------------------ | ------------ | ------------ | ----------------- | ----------------- |
| #0 - Uncategorized             | 12           | -            | 32h 50m           | 31h 05m           |
| MH-05                          | 12           | 2            | 13h 30m           | 14h 05m           |
| MH-06                          | 14           | 3            | 16h 30m           | 17h 10m           |
| MH-07                          | 17           | 8            | 27h 40m           | 26h 47m           |
| MH-08                          | 9            | 3            | 6h 00m            | 7h 05m            |
| MH-09 (partial, not committed) | 2            | -            | 1h 40m            | 1h 28m            |
| **Total**                | **66** | **16** | **98h 10m** | **97h 40m** |

- Hours per task per person: average **0.849 hours** (about 51 minutes), standard deviation **0.710 hours** (about 43 minutes).
- Total task estimation error ratio: **+-0.51%** (97h 40m / 98h 10m - 1)

## QUALITY MEASURES

- Unit Testing:
  - Total hours estimated: **2h 30m**
  - Total hours spent: **2h 30m**
  - Nr of automated unit test cases: **684**
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

## ASSESSMENT

### What caused errors in estimation?

- Implementation time was overestimated in some cases because parts of development were faster than expected.
- Mockups and their discussions required more time than estimated.
- Manual testing was underestimated because the team had not agreed in advance on uniform criteria, scope, or reporting requirements.

### What lessons did we learn in this sprint?

- The process of serializing the work inside each story mockup, backend, frontend, and testing while parallelizing separate stories worked well and should be retained.
- Manual testing is more consistent and less time-consuming when the team agrees in advance on the requirements to be met and the evidence to be documented.
- Implementation estimates can be reduced when development work is expected to be faster, but testing, review, integration, and debugging estimates should increase.

### Which improvement goals from the previous retrospective were achieved?

All improvement goals from the previous retrospective were achieved.

* we checked the dependency between stories
* we discussed mockups before writing code
* we avoided splitting a story among too many people.
* we asked the PO questions earlier, and tracked it on YouTrack
* we involved the people who will present the demo in manual testing

### Which goals were you not able to achieve? Why?

- None. We achieved the goals set in the previous retrospective.

### Improvement goals for the next sprint and how to achieve them

* Reduce implementation estimates where development is expected to be faster
* Increase time for manual testing
* Increase time for mockup implementation and their discussion

### One thing we are proud of as a team

We are proud that our workflow of sequencing tasks within each story and parallelizing independent stories worked well. It gave the team a practical balance between coordination and parallel development, and it provides a strong basis for improving estimation and quality practices in the next sprint.
