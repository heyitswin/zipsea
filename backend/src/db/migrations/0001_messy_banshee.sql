CREATE TABLE IF NOT EXISTS "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cruise_id" integer NOT NULL,
	"rate_code" varchar(50) NOT NULL,
	"cabin_code" varchar(10) NOT NULL,
	"occupancy_code" varchar(10) NOT NULL,
	"cabin_type" varchar(50),
	"base_price" numeric(10, 2),
	"adult_price" numeric(10, 2),
	"child_price" numeric(10, 2),
	"infant_price" numeric(10, 2),
	"single_price" numeric(10, 2),
	"third_adult_price" numeric(10, 2),
	"fourth_adult_price" numeric(10, 2),
	"taxes" numeric(10, 2),
	"ncf" numeric(10, 2),
	"gratuity" numeric(10, 2),
	"fuel" numeric(10, 2),
	"non_comm" numeric(10, 2),
	"port_charges" numeric(10, 2),
	"government_fees" numeric(10, 2),
	"total_price" numeric(10, 2),
	"commission" numeric(10, 2),
	"is_available" boolean DEFAULT true,
	"inventory" integer,
	"waitlist" boolean DEFAULT false,
	"guarantee" boolean DEFAULT false,
	"price_type" varchar(10) DEFAULT 'static',
	"currency" varchar(3) DEFAULT 'USD',
	"snapshot_date" timestamp DEFAULT now() NOT NULL,
	"change_type" varchar(20) NOT NULL,
	"change_reason" varchar(100),
	"price_change" numeric(10, 2),
	"price_change_percent" numeric(5, 2),
	"original_pricing_id" uuid,
	"batch_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "price_trends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cruise_id" integer NOT NULL,
	"cabin_code" varchar(10) NOT NULL,
	"rate_code" varchar(50) NOT NULL,
	"trend_period" varchar(10) NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"start_price" numeric(10, 2),
	"end_price" numeric(10, 2),
	"min_price" numeric(10, 2),
	"max_price" numeric(10, 2),
	"avg_price" numeric(10, 2),
	"total_change" numeric(10, 2),
	"total_change_percent" numeric(5, 2),
	"price_volatility" numeric(5, 2),
	"trend_direction" varchar(15),
	"change_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_history_cruise_id" ON "price_history" ("cruise_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_history_snapshot_date" ON "price_history" ("snapshot_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_history_cruise_snapshot" ON "price_history" ("cruise_id","snapshot_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_history_rate_code" ON "price_history" ("rate_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_history_cabin_code" ON "price_history" ("cabin_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_history_change_type" ON "price_history" ("change_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_history_batch_id" ON "price_history" ("batch_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_history_cruise_cabin_date" ON "price_history" ("cruise_id","cabin_code","rate_code","snapshot_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_trends_cruise_id" ON "price_trends" ("cruise_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_trends_period" ON "price_trends" ("trend_period","period_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_trends_direction" ON "price_trends" ("trend_direction");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_price_trends_cruise_cabin_period" ON "price_trends" ("cruise_id","cabin_code","trend_period","period_start");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_history" ADD CONSTRAINT "price_history_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "price_trends" ADD CONSTRAINT "price_trends_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
