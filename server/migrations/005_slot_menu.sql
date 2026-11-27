-- MH-10: each slot can have a menu, written by the staff and read by the hikers. The menu is free
-- text with a small subset of Markdown for the formatting (bold, italic, items and sub-items); its
-- rules are checked by the server before saving (domain/menu.js). The database only keeps the limits
-- that must never be broken: not empty, at most 2000 characters.
-- menu_saved_at orders the previous menus, newest first, when the staff starts from one of them.
-- A slot with no menu has both columns NULL. A menu can be changed or deleted only before its slot
-- starts (PO issue 59 of the requirements repository): the server checks it, not the database.

ALTER TABLE slot
    ADD COLUMN menu TEXT,
    ADD COLUMN menu_saved_at TIMESTAMPTZ,
    ADD CONSTRAINT slot_menu_length CHECK (menu IS NULL OR char_length(menu) BETWEEN 1 AND 2000),
    ADD CONSTRAINT slot_menu_saved_at CHECK ((menu IS NULL) = (menu_saved_at IS NULL));
