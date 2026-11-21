# Docker demo

Project of Team 16 for the Software Engineering 2 course at Politecnico di Torino, academic year 2026/2027: a web app for a mountain hut, to book tables for meals.

The whole app in one Docker image: the app, its PostgreSQL database and a mailbox for the emails, with demo data. You need only Docker: no code, no database, no other file.

## Run it

```bash
docker run --rm -p 3001:3001 -p 8025:8025 stealve/se2-mountain-hut
```

The image is on [Docker Hub](https://hub.docker.com/r/stealve/se2-mountain-hut). The first run downloads it. After a few seconds the log says `The demo is ready`: open http://localhost:3001.

| Port | What it is |
|---|---|
| `3001` | The web app and its API |
| `8025` | The mailbox: every email the app sends, see the Emails section below |

The database is inside the container, and nothing else is opened. Stop the demo with `Ctrl+C`: with `--rm` the container is deleted with its data, and the next run starts again from the demo data. To keep the data between runs, add a volume:

```bash
docker run --rm -p 3001:3001 -p 8025:8025 -v mountain-hut-demo:/var/lib/postgresql/data stealve/se2-mountain-hut
```

## Demo accounts

The demo creates one warden, two employees and one hiker. Other hikers can sign up from the application.

| Role | Name | Email | Password |
|---|---|---|---|
| Warden | Emily Parker | `emily.parker@quota.example` | `quota-demo-2026` |
| Employee | James Taylor | `james.taylor@quota.example` | `quota-demo-2026` |
| Employee | Oliver Wilson | `oliver.wilson@quota.example` | `quota-demo-2026` |
| Hiker | Lucas Bennett | `lucas.bennett@quota.example` | `quota-demo-2026` |

## Emails

The app sends an email when a hiker books a table, changes or cancels a booking, gets an account made by the staff, or asks for a new password.

**By default the emails stay inside the demo.** Nobody receives them. A mailbox called Mailpit, which is part of the image, collects them, and you read them on http://localhost:8025. It shows each email with its recipient, subject and text, whatever the address is, so you can try the app without writing to real people.

To try it:
1. Open http://localhost:3001 and log in as the demo hiker, `lucas.bennett@quota.example`.
2. Book a table.
3. Open http://localhost:8025. The confirmation is there, with the booking code (for example `QUOTA-00001`), the date, the time and the number of people.

### Receive the emails in your real inbox

Only if you want the emails to arrive in your own mailbox. The app cannot send an email by itself: it hands it to an email service (for example Gmail), and the service asks for an account to send it. You give the app that account with these variables, when you start the container:

```bash
docker run --rm -p 3001:3001 -p 8025:8025 \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_PORT=587 \
  -e SMTP_USER=you@gmail.com \
  -e SMTP_PASSWORD=your-app-password \
  -e MAIL_FROM="QUOTA <you@gmail.com>" \
  stealve/se2-mountain-hut
```

| Variable | What to write |
|---|---|
| `SMTP_HOST` | The address of the sending server of your email service. |
| `SMTP_PORT` | Its port, usually `587`. |
| `SMTP_USER` | The account that sends, usually your email address. |
| `SMTP_PASSWORD` | The password of that account. Gmail wants an app password (you need 2-step verification to make one), not your normal password. |
| `MAIL_FROM` | The sender that the receiver sees in the email. |

Then sign up in the app with your real email address and book a table. The address in the variables is who **sends** the emails, and the address of the account in the app is who **receives** them. They can be the same, to write to yourself.

If the service refuses an email, the booking is saved anyway and the error is written in the log of the container.
