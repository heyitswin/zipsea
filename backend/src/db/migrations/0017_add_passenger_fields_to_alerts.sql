-- Add passenger information fields to saved_searches for Traveltek pricing
ALTER TABLE "saved_searches" ADD COLUMN "adults" integer DEFAULT 2 NOT NULL;
ALTER TABLE "saved_searches" ADD COLUMN "children" integer DEFAULT 0 NOT NULL;
ALTER TABLE "saved_searches" ADD COLUMN "child_ages" integer[];
ALTER TABLE "saved_searches" ADD COLUMN "infants" integer DEFAULT 0 NOT NULL;
