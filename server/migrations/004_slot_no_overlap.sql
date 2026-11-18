-- MH-02: two slots of the same day cannot overlap in time. One that starts when the other ends is
-- fine (12:00-13:00 and 13:00-14:00); 12:00-13:00 and 12:30-13:30 are not, and neither are two slots
-- that start at the same time. The database decides, so two requests at the same time cannot both
-- create overlapping slots. The product owner confirmed the rule (SE2-Polito/AY26-27-Mountain-Hut#31).

-- Overlapping slots were allowed before. Slots can have bookings, so they are not changed here: the
-- migration stops and names them, and the README ("Slots that overlap") says how to fix them.
DO $$
DECLARE
    pairs TEXT;
BEGIN
    SELECT string_agg(
        format('%s: slot %s (%s-%s) and slot %s (%s-%s)',
            a.service_date, a.id, to_char(a.starts_at, 'HH24:MI'), to_char(a.ends_at, 'HH24:MI'),
            b.id, to_char(b.starts_at, 'HH24:MI'), to_char(b.ends_at, 'HH24:MI')),
        '; ' ORDER BY a.service_date, a.starts_at, b.starts_at)
    INTO pairs
    FROM slot a
    JOIN slot b ON b.service_date = a.service_date AND a.id < b.id
        AND a.starts_at < b.ends_at AND b.starts_at < a.ends_at;

    IF pairs IS NOT NULL THEN
        RAISE EXCEPTION 'Some slots of the same day overlap, so the rule slot_no_overlap cannot be added: %', pairs
            USING HINT = 'Change or delete one slot of each pair, then start again. See "Slots that overlap" in the README.';
    END IF;
END $$;

ALTER TABLE slot
    ADD CONSTRAINT slot_no_overlap
    EXCLUDE USING gist (tsrange(service_date + starts_at, service_date + ends_at, '[)') WITH &&);
