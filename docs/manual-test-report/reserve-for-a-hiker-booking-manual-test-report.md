# MH-07 — Reserve for a hiker: booking manual test report

## Scope and result

Nadim Aride manually checked employee reservations using Full profile and Quick entry in the Docker environment on 19 November 2026. The Full profile check included receipt of the account and booking emails and a successful password change. The Quick entry check was repeated for another temporary hiker. On 20 November, Nadim repeated both Full profile and Quick entry on a 384 × 695 mobile layout and supplied a Quick entry confirmation screenshot.

**Selected checks: 3 Pass.** These results describe the flows below, not complete coverage of MH-07.

| Run detail | Recorded value |
| --- | --- |
| Tester | Nadim Aride |
| Testing task | [MH-141](https://polito-se2-26-16.youtrack.cloud/issue/MH-141) |
| Story | MH-07 — Reserve for a hiker |
| Date / time / time zone | 19–20 November 2026, Europe/Rome (CET). For the 19 Nov run, Mailpit records the first account email at 18:51:34 and its booking email at 18:51:50. The mobile repeat was reported on 20 Nov; exact interaction times were not recorded. |
| Original report branch / commit | `test/manual-reserve-for-a-hiker-test-report` / `34705fa`. This identifies the report, not a verified application source revision. |
| Tested application build | The Docker app container created on 19 Nov at 18:47:30 CET uses image `sha256:0e64f83ffe175ff4094e2bc01a1b260fbd5e3d81d70fceaebfbc20364b912bac`. Inspected on 20 Nov; the source commit was not recorded during the run. |
| Browser / operating system | Windows; browser name/version was not recorded for this booking run. |
| Viewport | Mobile repeat: **384 × 695**, reported by Nadim Aride on 20 November 2026. Desktop dimensions were not recorded. |
| Client / API URL | Both served at `http://localhost:3001`. |
| Mailpit | `http://localhost:8026` for this run; host port 8026 maps to container port 8025. The default host port 8025 was occupied by a separate test inbox. |
| Database | PostgreSQL `mountain_hut` in `se2-project-team16-mountain-hut-db-1`, container port 5432. |
| Evidence | Tester observations below; Mailpit message IDs and read-only database results recovered on 20 Nov. A Quick entry mobile screenshot was supplied in the review conversation on 20 Nov; no repository screenshot file or HAR export is attached. |

## Method

The tester used the real employee UI, Docker application, PostgreSQL database, and Mailpit inbox. The observations below distinguish the original browser results from later inspection of saved data. Database persistence does not establish that the reservation list was inspected in the browser.

No account-email bodies, generated passwords, session cookies, or reset tokens are included.

## Manual checklist

| ID | Manual check | Steps performed | Expected result | Actual result / evidence | Status |
| --- | --- | --- | --- | --- | --- |
| MH07-B-01 | Full profile account and reservation | Created a Full profile hiker, booked the 20 Nov 2026 slot from 15:00 to 17:30 for 5 people, checked both emails, and changed the password. | A regular hiker account and booking are created; both emails arrive; the hiker can change the password. | The tester reported all steps succeeded. Saved booking `QUOTA-00001` belongs to regular hiker ID 5. Account email `RUoSQSeNgCdTWAsPMFQuV5` was received at 18:51:34 CET; booking email `hBsFNYbcT22cRDswemJ79W` at 18:51:50 CET. The booking email confirms 20 Nov, 15:00–17:30, 5 people. Password-change success was reported by the tester; its HTTP response was not retained. | Pass |
| MH07-B-02 | Quick entry reservation, repeated | Used Quick entry to reserve for a temporary hiker, then repeated the procedure for another temporary hiker. | Reservations can be saved without creating regular login accounts. | The tester reported successful reservations. Database inspection found bookings 2 and 3 for temporary hiker IDs 6 and 7, both on 20 Nov 2026, 15:00–17:30, for 10 and 4 people respectively. These are two executions of the same check. Appearance in the UI reservation list was not recorded. | Pass |
| MH07-B-03 | Mobile Full profile and Quick entry | Repeated both employee booking flows at **384 × 695** on 20 November 2026. | Both flows can be completed on a mobile layout and show a saved-reservation confirmation. | Nadim Aride reported repeating both flows. The supplied Quick entry screenshot shows **Reservation saved**, Testhiker Antonio, Sat 21 Nov, 12:00–13:00, 1 person, table T1; **Done** and **+ New reservation** are visible. Quick entry completion is supported by this screenshot; Full profile completion is tester-reported. The screenshot does not show the reservation list or booking reference. | Pass |

## Coverage

See the [MH-07 E2E scenario definitions](../e2e-definitions/MH-7-reserve-for-a-hiker-e2e-scenarios.md).

- B-01 checks the core behaviors described by scenarios 4 (Full profile), 12 (password change), and 17 (both emails).
- B-02 checks the core behaviors described by scenarios 3 (Quick entry) and 6 (temporary-hiker reservation).
- This mapping does not claim that every assertion in those scenarios was manually checked.
- Existing-hiker search/selection and booking (2, 5), party too large (8), duplicate booking (9), email conflict (10), started slot (11), password recovery (13), and invalid details (16) are outside this selected manual run. The definitions describe additional checks; this report does not certify their execution.
- General entry (1), staff booking inside the two-hour window (7), expired reset links (14), and rejected allocation (15) are also outside this run.

## Findings

None observed in the reported executions.

## Evidence and follow-up

The retained email and database records substantiate the original saved bookings. For the 20 November mobile repeat, the tester supplied the 384 × 695 viewport and confirmed both hiker types; the Quick entry success screenshot provides visual evidence of the saved details. Browser/version, tested source commit, mobile booking references, and reservation-list observations were not recorded. The viewport is tester-reported rather than inferred from the screenshot's pixel dimensions.

Moving this documentation onto a branch based on qa does not establish that the original browser checks were run against qa.

No application code was changed. Application lint/tests were not rerun for this documentation-only update.
