# Active hikes mockup (MH-21)

Mockup for story **MH-21 View active hikes**, used by the staff frontend and backend tasks and their tests.

> "As an employee I want to see all hikers who are currently registered as being on a hike so that I can monitor their expected return times."

One new page, **Active hikes**, lists the hikes in progress of all hikers. It is read only: the employee (or the warden) looks at it to follow the expected return times. The hikers register their hikes in [MH-20](../register-a-hike/README.md).

**Figma (source of truth):** page *MH-21 View active hikes* in [Mountain Hut – Mockups (Team 16)](https://www.figma.com/design/VlTombwHX1DQ7yB2x4U5Yx?node-id=786-23191). Every element is an instance from the *Components* page. Most of them are already used by the [slots mockup](../slots/README.md), the [register a hike mockup](../register-a-hike/README.md) and the [booking](../booking/README.md) mockup: button, alert, trail blaze, route icon and the phone bars. This story adds:

- *Navbar / Staff with Active hikes*: the staff navbar with a fourth link, **Active hikes**, after *The hut*, *Slots & tables* and *Reservations*. Variants: `Role` (Employee, Warden). It is a separate navbar for this page: the shared *Navbar / Logged in* is not changed.
- *Active hike card*: one hike of the list. Variants: `Size` (Desktop, Phone). It shows the expected return on the left, then the hiker, the destination, the route, the departure and the passage points.

Same QUOTA brand, colours and fonts.

## Rules on these screens

Everything shown comes from the story or from the product owner's answers. Nothing from later stories.

| Source | Rule |
|---|---|
| Story MH-21 | The employee sees all the hikers who are currently registered as being on a hike, to monitor their expected return times. |
| Story MH-21 (notes) | The information of a hike is its destination (a name), its route (a text description) and its intermediate passage points. |
| Product owner, [#51](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/51) | A hike has a planned departure and an expected return, both with day and time. |
| Product owner, [#53](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/53) | A hike is considered started at its planned departure time. A hiker who decides not to leave declares the hike finished with MH-22, even before it starts. |
| Team decision (not yet confirmed by the product owner) | **Active** means: from the planned departure time until the hiker declares the hike finished. A hike that has not started is not listed. A hike past its expected return time stays listed until it is finished. |
| Team decision (not yet confirmed by the product owner) | The hikes are listed by expected return time, the soonest first. |
| Team decision (not yet confirmed by the product owner) | Each hike shows the hiker's name, the expected return (time and day), the destination, the route, the departure and the passage points in order. A hike without passage points shows none. |
| Team decision (not yet confirmed by the product owner) | The page is the same for the employee and for the warden, who can do everything an employee can (same navbar, *Warden*). It is reached from a new navbar link, *Active hikes*, after *Reservations*. |
| Team decision | The page is read only. Marking a hike as completed by the staff (MH-30), the alerts for late hikers (MH-24, MH-26) and the emergency details (MH-25) are other stories. |

## The flow

1. The employee opens **Active hikes** from the navbar (screen 1). The page lists every hiker who is on a hike, by expected return time, the soonest first. A line on the top right says how many hikers are on a hike.
2. Each hike is a card. On the left the **expected return**: the time, and under it the day. On the right the hiker's name, the destination with the route, the departure (day and time) and the passage points in order, joined by arrows.
3. A hike stays on the list until the hiker declares it finished with MH-22. So a hike that is past its expected return time is still listed, in its place by expected return time.
4. With no hike in progress, the page says so (screen 2).
5. A hike with many passage points shows all of them, in a line that wraps. The card grows and nothing is cut (screen 3).
6. If the list cannot be loaded, a red note says so (screen 4).

There is nothing to press on the page: the cards have no buttons.

## Screens

| # | Screen | Image |
|---|---|---|
| 1 | Active hikes | ![Active hikes](01-active-hikes.png) |
| 2 | No active hikes | ![No active hikes](02-no-active-hikes.png) |
| 3 | A hike with many passage points | ![Many passage points](03-many-passage-points.png) |
| 4 | The list does not load | ![The list does not load](04-list-does-not-load.png) |

### On a phone

This is the same website in a phone browser, not a separate app. Below 992 px (react-bootstrap `lg`) the layout changes:

- The page becomes one column.
- The navbar folds into the menu button, where *Active hikes* is.
- In a card, the route goes under the destination, and the passage points wrap.

| # | Screen | Image |
|---|---|---|
| 1 | Active hikes | ![Active hikes on a phone](phone/01-active-hikes.png) |
| 2 | No active hikes | ![No active hikes on a phone](phone/02-no-active-hikes.png) |

The list with many passage points and the error are the same as on a computer.

## Fields and rules

### Active hikes

| Part | Rule |
|---|---|
| Which hikes | The hikes of all hikers that have started (planned departure time passed) and are not finished. |
| Order | By expected return time, the soonest first. |
| Count | "*N* hikers on a hike", above the list, on the right. |
| Expected return | Time (*15:30*) and day (*Sat 17 Jul*). The day is shown also when it is not today. |
| Hiker | The name of the hiker who registered the hike. |
| Destination, route | The destination in bold, the route description after it (under it on a phone). |
| Departure | Day and time (*Sat 17 Jul · 07:30*). |
| Passage points | In order, separated by an arrow (*Colle Basso → Pian dei Fiori*). All of them are shown, on as many lines as needed. A hike without passage points shows none. |
| Buttons | None. |

## Texts and answers

| When | What the employee sees |
|---|---|
| Page subtitle | Hikers on a hike now, by expected return time. |
| *Good to know* | A hike is on this list from its planned departure time until the hiker declares it finished. · Hikes are listed by expected return time, the soonest first. · A hike whose expected return time has passed stays on the list until it is finished. · This helps the hut, but it does not replace rescue services. |
| No hikes | **No active hikes.** Hikers who are on a hike will appear here, with the time they expect to be back. |
| List not loaded | Red note: "Something went wrong on our side. Try again in a minute." |
| Not logged in (`401`) | The login page (login mockup, screen 4). |

## Left out on purpose

These belong to other stories or were not asked for:

- Alerts and notifications for hikers who are late or missing (MH-24, MH-26).
- The emergency details of a party and the party members (MH-23, MH-25).
- Marking a hike as completed by the staff and managing registered hikes (MH-30), registering a hike for a hiker (MH-28), updating a hike (MH-27).
- The route on a map (MH-29).
- Search, filters and any other way to sort the list.
- The hiker's phone number and emergency contact.

## Open questions

These are for the product owner. Until they are answered, the mockup follows the team decisions above.

- **What an active hike is.** The mockup lists a hike from its planned departure time until the hiker declares it finished (#53), so a hike past its expected return time stays listed. Is this what the staff expect?
- **Late hikes.** Should a hike past its expected return time be marked in the list, before the alerts of MH-24? The mockup does not mark it.
- **What the employee sees of each hiker.** The mockup shows the name, the destination, the route, the times and the passage points. Does the employee also need the phone number or the number of people (MH-23)?
- **Refresh.** Does the list refresh by itself (and how often), or is it loaded when the page is opened?
- **Who sees it.** The employee and the warden see the same page. Is that right?
- **Hikers with no hike.** The page lists hikes, not hikers: a hiker with two hikes in progress is not possible (two hikes cannot overlap, MH-20), so there is one card per hiker.

The names, hikes, days and times of the screens are examples. Sample data (hut, names, dates) is invented for the mockup.
