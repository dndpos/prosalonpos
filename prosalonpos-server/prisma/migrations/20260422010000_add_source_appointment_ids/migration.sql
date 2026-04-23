-- cc15.4: per-ticket list of source appointment_ids for merge absorbers.
-- Before cc15.4, an absorber only tracked the FIRST source's appointment_id
-- in the scalar `appointment_id` column, leaving every other source slip
-- unable to resolve back to the merged ticket. This adds a JSON array
-- column so any slip can map to its absorber regardless of which source
-- position it held.

ALTER TABLE "Ticket" ADD COLUMN "source_appointment_ids" JSONB;
