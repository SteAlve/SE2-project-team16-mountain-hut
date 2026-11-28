-- MH-20: where a hike starts. The hiker can choose it; a hike without one starts at the hut, the usual
-- start, so NULL means the hut (team decision: the product owner lists only the destination, the
-- route and the passage points, #49). It is a new file, not a change of 006, so a database that
-- already has the table hike only gets the column.
--
-- One line, 1 to 100 characters: the server checks the line, the database the length.
ALTER TABLE hike
    ADD COLUMN start_point TEXT
        CHECK (start_point IS NULL OR char_length(btrim(start_point)) BETWEEN 1 AND 100);
