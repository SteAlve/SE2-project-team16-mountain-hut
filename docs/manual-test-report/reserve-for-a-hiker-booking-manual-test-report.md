# MH-07 — Reserve for a hiker: booking manual test report

## Scope and result

Manual verification of the employee flow for creating a reservation for a hiker.
The report will record the browser checks performed by the user, including the
hiker selection or creation flow, party details, table allocation, confirmation,
validation, permissions, and any observed issues.

The recorded checks completed successfully: a Full profile hiker account
was created, both expected emails were received, and the hiker changed the
generated password successfully.

| Run detail | Recorded value |
| --- | --- |
| Tester | User |
| Date / time / time zone | TODO |
| Task / PR | MH-07 — Reserve for a hiker |
| Branch / commit | TODO |
| Browser / operating system | TODO |
| Client / API URL | `http://localhost:5173` / `http://localhost:3001` |
| Database / fixtures | TODO |

## Method

Use the real employee UI with the real client, API, database, and email capture
where relevant. For each test the user reports, record the steps performed, the
expected result, the actual result, the status, and any evidence or issue link.
Do not record passwords, reset tokens, session cookies, or other credentials.

## Manual checklist

Add each completed test below as it is performed.

| ID | Manual check | Steps performed | Expected result | Actual result / evidence | Status |
| --- | --- | --- | --- | --- | --- |
| MH07-B-02 | Full-profile hiker account, booking confirmation, and first password change | With Docker running, as an employee created a hiker account through **Full profile**, selected a `15:00–17:30` slot for the hiker, checked the Docker Mailpit inbox, and changed the generated password through the hiker flow. | The hiker account is created; the account-creation email and booking-confirmation email are delivered; the hiker can successfully replace the generated password with a chosen password. | The Full profile account was created successfully. The hiker received the account-creation email and the booking-confirmation email. The hiker also changed the generated password successfully. | Pass |
| MH07-B-03 | Quick-entry temporary hiker reservation | As an employee, used **Quick entry** to create a reservation for a hiker without creating a regular hiker account. | The reservation can be completed for a temporary hiker without an account. No account-creation email or password-change flow is expected because the hiker has no login account. | The reservation was performed successfully without creating a hiker account. | Pass |
| MH07-B-04 | Second Quick-entry temporary hiker reservation | Repeated the Quick entry reservation procedure as an employee with a different hiker account. | The second reservation can be completed without creating a regular hiker account. No account-creation email or password-change flow is expected. | The same procedure was performed successfully with another account. No regular hiker account was created. | Pass |
| MH07-B-05 | Employee booking flow on a mobile screen | Repeated the employee booking procedure using a mobile-screen layout. | The employee booking flow remains usable on a mobile screen, with the hiker selection, slot selection, review popup, and confirmation controls accessible. | The procedure was completed successfully on the mobile screen. | Pass |

## Findings

Add confirmed defects or usability observations here, including reproduction
steps and the affected test ID.

## Outcome and follow-up

Current recorded result: **4 Pass**. Continue adding further employee booking checks as they are performed.
