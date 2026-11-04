-- MH-02: two slots of the same day cannot overlap in time. One that starts when the other ends is
-- fine (12:00-13:00 and 13:00-14:00); 12:00-13:00 and 12:30-13:30 are not, and neither are two slots
-- that start at the same time. The database decides, so two requests at the same time cannot both
-- create overlapping slots (the product owner has not confirmed this rule yet).
-- A database that already has overlapping slots needs them fixed before this migration can run.
ALTER TABLE slot
    ADD CONSTRAINT slot_no_overlap
    EXCLUDE USING gist (tsrange(service_date + starts_at, service_date + ends_at, '[)') WITH &&);
