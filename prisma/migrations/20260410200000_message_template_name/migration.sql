-- Add name field to MessageTemplate
ALTER TABLE "MessageTemplate" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
