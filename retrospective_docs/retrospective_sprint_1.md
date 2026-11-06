# Retrospective — Sprint 1 (Team 16)

## PROCESS MEASURES 

### Macro statistics

- Number of stories committed vs done: **4 / 4**
- Total points committed vs done: **16 / 16**
- Nr of hours planned vs spent (as a team): **109h 30m** / **97h 23m**

**Remember**  a story is done ONLY if it fits the Definition of Done:
 
- Unit Tests passing
- Code review completed
- Code present on VCS
- End-to-End tests performed

### Detailed statistics

| Story | # Tasks | Points | Hours est. | Hours actual |
|-------|---------|--------|------------|--------------|
| #0 - Uncategorized | 20 | - | 51h 00m | 47h 05m |
| MH-01 | 12 | 8 | 17h 30m | 18h 25m |
| MH-02 | 14 | 3 | 19h 15m | 17h 43m |
| MH-03 | 7 | 2 | 6h 00m | 5h 00m |
| MH-04 | 13 | 3 | 15h 45m | 9h 10m |
| **Total** | **66** | **16** | **109h 30m** | **97h 23m** |
  

- Hours per task per person: average **0.946 hours**, standard deviation **0.650 hours**.

- Total task estimation error ratio: **-11.07%** (97h 23m / 109h 30m - 1)

  
## QUALITY MEASURES

- Unit Testing:
  - Total hours estimated: **10h 30m**
  - Total hours spent: **5h 45m**
  - Nr of automated unit test cases: **349**
  - Coverage: **96.81% lines, 96.82% statements, 94.78% branches, 97.70% functions**
- Integration testing:
  - Total hours estimated: **3h 00m**
  - Total hours spent: **2h 40m**
- E2E testing:
  - Total hours estimated: **9h 45m**
  - Total hours spent: **8h 40m**
- Code review:
  - Total hours estimated: **13h 30m**
  - Total hours spent: **12h 10m**

## ASSESSMENT

### What caused your errors in estimation (if any)?

- Some tasks took less time than expected because they reused work from earlier stories. We did not consider this enough when estimating.
- We did not always discuss the mockups together, so some details became clear only during development.
- Manual frontend testing and some fixes took more time than expected.
- Too many people worked on separate parts of the same story. It took extra time to understand each other's work.

### What lessons did you learn (both positive and negative) in this sprint?

- Clear deadlines and a flexible architecture helped us work on different parts of the application at the same time.
- We learned that we need to agree on how features should work before coding, reduce handovers and leave time for integration tests and possible fixes.

### Which improvement goals from the previous retrospective did you achieve?

We achieved all the improvement goals set in the previous retrospective.

- We discussed together which stories to include in the sprint.
- A small group created the YouTrack tasks after the team discussion during sprint planning.
- We improved task descriptions and made it clearer which tasks had to be finished first.
- We included code review in our planning.
- We set deadlines to help finish the work that others were waiting for.
- We divided work across backend, frontend and database, so development, review and testing could move forward at the same time.

### Which goals were you not able to achieve? Why?

- None. We achieved the goals set in the previous retrospective. The next goals build on this progress.

### Improvement goals for the next sprint and how to achieve them

- **Improve planning and estimates.**
  - Check the dependencies between stories before estimating and plan the tasks in the right order.
  - Discuss the mockups together before coding. Agree on how each feature should work and write down the decisions.
  - Include time for integration tests in our estimates and allow extra time for possible fixes.
- **Improve coordination and preparation for testing.**
  - Avoid splitting a story among too many people. For example, one person can work on the backend and another on the frontend, with other people reviewing and testing.
  - Ask the PO questions earlier through GitHub issues and track this work in YouTrack. Choose one person to check the replies and share them with the team.
  - Involve the people who will present the demo in manual testing, so they understand the main features and feel more confident with the application.
  - Report delays early and leave time for fixes during the week. Keep respecting deadlines and aim to keep weekends free.

### One thing you are proud of as a team

- We are proud of how we planned our schedule and met our deadlines. Our flexible architecture helped us work in parallel and reduced the time spent waiting for other tasks.
