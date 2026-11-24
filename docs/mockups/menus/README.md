# Menus mockup (MH-10)

Mockup for story **MH-10 Define menus**, used by the staff and hiker frontend tasks, the backend tasks and their tests.

> "As an employee I want to specify the menus for the defined slots so that hikers know when the hut is providing the service."

**Figma (source of truth):** page *MH-10 Menus* in [Mountain Hut – Mockups (Team 16)](https://www.figma.com/design/VlTombwHX1DQ7yB2x4U5Yx?node-id=677-2504). Every element is an instance from the *Components* page. Most of them are already used by the [slots](../slots/README.md), [copy a week](../copy-week/README.md), [booking](../booking/README.md), [availability](../availability/README.md) and [hiker booking page](../hiker-booking-page/README.md) mockups: navbar, week strip, slot row, table chip, alert, text field, button, time slot, booking card and the phone bars. This story adds:

- *Format button*: one button of the editor toolbar. Variants: `Kind` (Bold, Italic, List, Sub-item, Up a level) and `State` (Default, Active: the format where the cursor is).
- *Menu toolbar*: the five format buttons on top of the editor. Property `Show hint` (the keyboard hint, hidden on a phone).
- *Menu text*: a menu as it is shown, with bold, italic, items and sub-items. Variants: `Content` (Short: the dinner used on most screens; Long: a three-course menu, to show how a long menu is read).
- *Menu editor*: the *Menu* field. Variants: `State` (Empty, Filled, Error). The writing area has a fixed height: a long menu scrolls inside it (property `Scrollbar`).
- *Previous menu*: a menu already written for another slot, to start from. Variants: `State` (Default, Selected, Open). *Open* shows the whole menu, formatted, inside the card (phone).
- *Slot menu*: the menu line at the bottom of a slot on *Slots & tables*. Variants: `State` (Set, Empty, and Expanded only on a phone) and `Size` (Desktop, Phone). *Set* shows the first words of the menu and *Show menu*; on a phone it also has *Edit menu*, and *Expanded* shows the whole menu under the slot.
- *Slot with menu*: a *Slot row* with its *Slot menu* under it.
- *Menu card*: the menu of the chosen time on *Book a table*. Variants: `State` (Set, Empty).
- *Booking menu*: the menu at the bottom of a booking on *My bookings*. Variants: `State` (Collapsed, Expanded, Empty) and `Size` (Desktop, Phone).

Same QUOTA brand, colours and fonts.

## Rules on these screens

| Source | Rule |
|---|---|
| Story | Each slot can have a menu. An employee writes it on *Slots & tables*; the warden can do the same (same page). |
| Story | Hikers see the menu of a time, so they know what the hut serves then: on *Book a table* (also before logging in, when they check availability) and on *My bookings*. |
| [#39](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/39) | The menu is free text, not a list of dishes chosen from a catalogue. |
| [#39](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/issues/39) | A menu written before can be reused and changed. The reused text is copied: changing it changes only the new slot, never the slot it came from. |
| Story (clarifications) | Basic formatting: bold, italic, a list of items and sub-items. |

## The flow

### Employee: Slots & tables

1. **The menu of each slot.** Under the tables of each slot there is a *Menu* line. A slot with a menu shows its first words, on one line, and *Show menu*; a slot without one says "No menu yet. Hikers see only the time." and has *Write the menu* (screen 1).
2. **Show the menu.** *Show menu* opens a dialog titled *Menu*, with the slot under the title (day, time and table set) and the whole menu, formatted as hikers see it; a long menu scrolls inside its box (screen 6). *Edit menu* opens *Edit the menu* (screen 7); *Close* goes back to the slots.
3. **Edit the menu.** The same editor as *Write the menu*, titled *Edit the menu*, with the current menu and its formatting already in it (screen 7). It is changed like any text and saved with *Save menu*; *Start from a previous menu* (a button at the bottom left) still works and replaces the current text; *Cancel* keeps the menu as it was.
4. **Write the menu.** *Write the menu* opens a dialog. Under the title it says which slot the menu is for: day, time and table set. The *Menu* field is a small editor with a toolbar (screen 2):
   - **B** bold, *I* italic (also Ctrl+B and Ctrl+I);
   - the list button starts a bulleted list: Enter adds the next item;
   - the sub-item button (or Tab, in a list) moves an item one level in; the up-a-level button (or Shift+Tab) moves it back out. Two levels are enough: items and sub-items;
   - the button of the format where the cursor is looks pressed.

   The writing area keeps its height: a long menu scrolls inside it. Under the field, on the right, a counter shows the characters used, `N / 2000`.
5. **Start from a previous menu.** *Choose a menu* opens the menus already written for other slots, newest first (screen 3). The same text is listed once, with the last slot it was given to. On the left, each menu shows its slot and its first two lines, so it can be recognised; *Search the menus* finds a dish or a day, and *Show older menus* loads more. On the right, the **preview** shows the chosen menu whole, formatted as hikers see it (bold, italic, items and sub-items); a long menu scrolls inside the preview. On a phone there is no room for two columns: tapping a menu opens it inside its card, formatted, and the sheet scrolls (phone screen 3). *Use this menu* copies it into the editor and replaces what was there; *Back* returns to the editor as it was.
6. **Change the copied menu.** The copied menu is in the editor, with its bold, italic and lists, and can be changed like any text; here a starter was changed. An info alert says where it was copied from (screen 4). *Choose another menu* goes back to step 5.
7. **Save menu.** The dialog closes, an alert names the slot, and the slot shows the first words of its new menu and *Show menu* (screen 5). Hikers see the menu from now on.

On a phone, *Show menu* opens the menu under the slot instead of in a dialog, and *Edit menu* sits next to it (phone screen 1); it opens *Edit the menu* in a sheet, with *Start from a previous menu* under the editor (phone screen 5).

### Hiker and visitor

- **Book a table** (screen 9, logged in) and **Check availability** (screen 10, before logging in): with a time chosen, the *Your booking* summary shows the whole menu of that time, under the day, the time and the people. Choosing another time shows its menu. A time with no menu yet says "No menu yet for this time. You can still book it."
- **My bookings** (screen 11): each booking has a *Menu* line at the bottom: the first words and *Show menu*, which opens the whole menu under the booking; *Hide menu* closes it. A booking whose time has no menu yet says "No menu yet for this time." The menu belongs to the slot: when the employee changes it, the hiker sees the new one.

## Screens

| # | Screen | Image |
|---|---|---|
| 1 | Slots of a day, with menus | ![Slots of a day, with menus](01-slots-of-a-day.png) |
| 2 | Write the menu | ![Write the menu](02-write-the-menu.png) |
| 3 | Start from a previous menu | ![Start from a previous menu](03-previous-menu.png) |
| 4 | Change the copied menu | ![Change the copied menu](04-change-the-copied-menu.png) |
| 5 | Menu saved | ![Menu saved](05-menu-saved.png) |
| 6 | Show the menu | ![Show the menu](06-show-the-menu.png) |
| 7 | Edit the menu | ![Edit the menu](07-edit-the-menu.png) |
| 8 | Menu left empty (error) | ![Menu left empty](08-menu-left-empty.png) |
| 9 | A hiker sees the menu on Book a table | ![A hiker sees the menu](09-hiker-sees-the-menu.png) |
| 10 | Check availability: the menu of the time | ![Check availability](10-check-availability.png) |
| 11 | My bookings: the menu of each booking | ![My bookings](11-my-bookings.png) |

Screens 10 and 11 are taller than 800 px: the page scrolls.

### On a phone

The same website in a phone browser. Below 992 px (react-bootstrap `lg`) the dialogs become sheets from the bottom, with *Save menu* (or *Use this menu*) as the first button at the bottom. The toolbar keeps its five buttons; the keyboard hint is hidden. On *Slots & tables* there is no room for a second dialog over the page: *Show menu* opens the menu under the slot, and *Edit menu* is next to it (phone screen 1). In *Start from a previous menu* the chosen menu opens inside its card (phone screen 3). On *Book a table* the menu is under the times. On *Check availability* the answer sits in the bar at the bottom ([availability mockup](../availability/README.md)), so the menu is there too, closed like on *My bookings*: the first words and *Show menu*.

| # | Screen | Image |
|---|---|---|
| 1 | Slots of a day, with a menu opened | ![Slots of a day on a phone](phone/01-slots-of-a-day.png) |
| 2 | Write the menu | ![Write the menu on a phone](phone/02-write-the-menu.png) |
| 3 | Start from a previous menu | ![Start from a previous menu on a phone](phone/03-previous-menu.png) |
| 4 | Change the copied menu | ![Change the copied menu on a phone](phone/04-change-the-copied-menu.png) |
| 5 | Edit the menu | ![Edit the menu on a phone](phone/05-edit-the-menu.png) |
| 6 | A hiker sees the menu on Book a table (scrolled to step 3) | ![A hiker sees the menu on a phone](phone/06-hiker-sees-the-menu.png) |
| 7 | Check availability: the menu in the bar | ![Check availability on a phone](phone/07-check-availability.png) |
| 8 | My bookings: the menu of each booking | ![My bookings on a phone](phone/08-my-bookings.png) |

## Fields and rules

### Write the menu

| Field | Required | Rule | Message |
|---|---|---|---|
| Menu | yes | at least one visible character: spaces, empty lines and empty list items alone count as empty | Write the menu, or start from a previous one. |
| Menu | yes | at most 2000 characters (the counter turns red past it, and *Save menu* shows the message) | The menu can be at most 2000 characters. |

The error looks like the other field errors (screen 8): the field turns red and the message is right under it. The rules are checked in the browser before sending and again by the server (`400` if they fail).

The formatting is kept as text the server can store and check, for example a small subset of Markdown: `**bold**`, `*italic*`, `- ` for an item and two spaces before `- ` for a sub-item. Nothing else is accepted (no links, headings or HTML), and the menu is shown escaped, so it cannot inject markup.

## Texts and server answers

| When | What the user sees |
|---|---|
| Slot with a menu (desktop) | **MENU** · the first words, on one line · button *Show menu* |
| Show menu (desktop) | Dialog **Menu** · *day* · *start – end* · *table set*, then the whole menu, formatted. Buttons: Close, Edit menu |
| Slot with a menu (phone) | **MENU** · the first words · buttons *Show menu ▾* and *Edit menu*; opened: *Hide menu ▴*, then the whole menu |
| Slot with no menu | **MENU** · No menu yet. Hikers see only the time. · button *Write the menu* |
| Dialog title | Write the menu (a slot with no menu) or Edit the menu (from *Edit menu*) · under it: *day* · *start – end* · *table set* |
| Start from a previous menu (box) | **Start from a previous menu** Copy a menu you already wrote, then change what is different. Button: Choose a menu |
| Previous menus | Left: each menu with its slot and its first two lines. Right: **PREVIEW** · *day* · *start – end*, then the chosen menu, formatted. Note: The menu you choose replaces what is in the editor. You can change it before saving. A long menu scrolls inside the preview. Buttons: Show older menus, Back, Use this menu |
| No previous menus yet | The box *Start from a previous menu* is not shown. |
| Search with no result | No menu has "*search*". Try a dish or a day. |
| Menu copied | Info alert: Copied from *day*, *start – end*. Changing it here does not change that menu. |
| Under the editor | Hikers see the menu as you write it here. · *N* / 2000 |
| Menu saved (`200`) | The dialog closes. Info alert on the page: Menu saved for *day*, *start – end*. Hikers see it when they choose this time. |
| Menu empty or too long (`400`) | The message under the field (see *Fields and rules*). |
| Slot no longer exists (`404`) | The dialog closes, the day is reloaded, alert on top: "That slot no longer exists." |
| Not logged in (`401`) | The login page with the blue note "Log in to see the slots and tables." (login mockup, screen 4). |
| A hiker tries to save a menu (`403`) | The "Staff only" page (login mockup, screen 7). |
| Server or network down | Something went wrong on our side. Try again in a minute. |
| Book a table, time with a menu | **Menu** *start – end*, then the menu as it was written |
| Book a table, time with no menu | No menu yet for this time. You can still book it. |
| My bookings | **MENU** · the first words · *Show menu ▾* / *Hide menu ▴*; with no menu: No menu yet for this time. |

## Left out on purpose

These are not in any story, so they are not here: removing a menu (an employee can change it, not delete it), prices, one entry per dish, dietary labels on dishes (the dietary needs of a party are MH-05), menus on the landing page.

## Assumptions to confirm

Not asked to the product owner; the mockup works either way:

- A slot with no menu can still be booked: the menu is information for the hiker, not a condition for the booking.
- A menu is at most 2000 characters.
- *Copy a week* (MH-09) copies the slots without their menus, so a copied week starts with no menus.
- Two employees editing the same menu: the last *Save menu* wins.
- The endpoints for reading, saving and listing the previous menus are not defined yet, so `docs/openapi.json` is unchanged.

Sample data (hut, names, dates, tables, dishes) is invented for the mockup.
