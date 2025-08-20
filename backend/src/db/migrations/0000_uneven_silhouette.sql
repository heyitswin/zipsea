CREATE TABLE IF NOT EXISTS "cabin_categories" (
	"ship_id" integer NOT NULL,
	"cabin_code" varchar(10) NOT NULL,
	"cabin_code_alt" varchar(10),
	"name" varchar(255) NOT NULL,
	"description" text,
	"category" varchar(50) NOT NULL,
	"category_alt" varchar(50),
	"color_code" varchar(7),
	"color_code_alt" varchar(7),
	"image_url" varchar(500),
	"image_url_hd" varchar(500),
	"is_default" boolean DEFAULT false,
	"valid_from" date,
	"valid_to" date,
	"max_occupancy" integer DEFAULT 2,
	"min_occupancy" integer DEFAULT 1,
	"size" varchar(50),
	"bed_configuration" varchar(100),
	"amenities" jsonb DEFAULT '[]',
	"deck_locations" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cabin_categories_ship_id_cabin_code_pk" PRIMARY KEY("ship_id","cabin_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cruise_lines" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(10),
	"logo_url" varchar(500),
	"description" text,
	"website" varchar(255),
	"headquarters" varchar(255),
	"founded_year" integer,
	"fleet_size" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alternative_sailings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_cruise_id" integer NOT NULL,
	"alternative_cruise_id" integer NOT NULL,
	"sailing_date" date NOT NULL,
	"price" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cruises" (
	"id" integer PRIMARY KEY NOT NULL,
	"code_to_cruise_id" varchar(50) NOT NULL,
	"cruise_line_id" integer NOT NULL,
	"ship_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"itinerary_code" varchar(50),
	"voyage_code" varchar(50),
	"sailing_date" date NOT NULL,
	"return_date" date,
	"nights" integer NOT NULL,
	"sail_nights" integer,
	"sea_days" integer,
	"embark_port_id" integer,
	"disembark_port_id" integer,
	"region_ids" jsonb DEFAULT '[]',
	"port_ids" jsonb DEFAULT '[]',
	"market_id" integer,
	"owner_id" integer,
	"no_fly" boolean DEFAULT false,
	"depart_uk" boolean DEFAULT false,
	"show_cruise" boolean DEFAULT true,
	"fly_cruise_info" text,
	"line_content" text,
	"traveltek_file_path" varchar(500),
	"last_cached" timestamp,
	"cached_date" date,
	"currency" varchar(3) DEFAULT 'USD',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"phone" varchar(20),
	"preferences" jsonb DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ships" (
	"id" integer PRIMARY KEY NOT NULL,
	"cruise_line_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"ship_class" varchar(100),
	"tonnage" integer,
	"total_cabins" integer,
	"capacity" integer,
	"rating" integer,
	"description" text,
	"highlights" text,
	"default_image_url" varchar(500),
	"default_image_url_hd" varchar(500),
	"images" jsonb DEFAULT '[]',
	"additional_info" text,
	"amenities" jsonb DEFAULT '[]',
	"launched_year" integer,
	"refurbished_year" integer,
	"decks" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ports" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(10),
	"country" varchar(100),
	"country_code" varchar(2),
	"state" varchar(100),
	"city" varchar(100),
	"latitude" numeric(10, 8),
	"longitude" numeric(11, 8),
	"timezone" varchar(50),
	"terminal" varchar(255),
	"description" text,
	"images" jsonb DEFAULT '[]',
	"amenities" jsonb DEFAULT '[]',
	"transport_options" jsonb DEFAULT '[]',
	"popular_attractions" jsonb DEFAULT '[]',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regions" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"parent_region_id" integer,
	"description" text,
	"code" varchar(10),
	"display_order" integer DEFAULT 0,
	"is_popular" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "itineraries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cruise_id" integer NOT NULL,
	"day_number" integer NOT NULL,
	"date" date NOT NULL,
	"port_name" varchar(255) NOT NULL,
	"port_id" integer,
	"arrival_time" time,
	"departure_time" time,
	"status" varchar(20) DEFAULT 'port',
	"overnight" boolean DEFAULT false,
	"description" text,
	"activities" jsonb DEFAULT '[]',
	"shore_excursions" jsonb DEFAULT '[]',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cheapest_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cruise_id" integer NOT NULL,
	"cheapest_price" numeric(10, 2),
	"cheapest_cabin_type" varchar(50),
	"cheapest_taxes" numeric(10, 2),
	"cheapest_ncf" numeric(10, 2),
	"cheapest_gratuity" numeric(10, 2),
	"cheapest_fuel" numeric(10, 2),
	"cheapest_non_comm" numeric(10, 2),
	"interior_price" numeric(10, 2),
	"interior_taxes" numeric(10, 2),
	"interior_ncf" numeric(10, 2),
	"interior_gratuity" numeric(10, 2),
	"interior_fuel" numeric(10, 2),
	"interior_non_comm" numeric(10, 2),
	"interior_price_code" varchar(50),
	"oceanview_price" numeric(10, 2),
	"oceanview_taxes" numeric(10, 2),
	"oceanview_ncf" numeric(10, 2),
	"oceanview_gratuity" numeric(10, 2),
	"oceanview_fuel" numeric(10, 2),
	"oceanview_non_comm" numeric(10, 2),
	"oceanview_price_code" varchar(50),
	"balcony_price" numeric(10, 2),
	"balcony_taxes" numeric(10, 2),
	"balcony_ncf" numeric(10, 2),
	"balcony_gratuity" numeric(10, 2),
	"balcony_fuel" numeric(10, 2),
	"balcony_non_comm" numeric(10, 2),
	"balcony_price_code" varchar(50),
	"suite_price" numeric(10, 2),
	"suite_taxes" numeric(10, 2),
	"suite_ncf" numeric(10, 2),
	"suite_gratuity" numeric(10, 2),
	"suite_fuel" numeric(10, 2),
	"suite_non_comm" numeric(10, 2),
	"suite_price_code" varchar(50),
	"currency" varchar(3) DEFAULT 'USD',
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cheapest_pricing_cruise_id_unique" UNIQUE("cruise_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pricing" (
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
	"price_timestamp" timestamp,
	"currency" varchar(3) DEFAULT 'USD',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quote_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"cruise_id" integer NOT NULL,
	"cabin_code" varchar(10),
	"cabin_type" varchar(50),
	"passenger_count" integer NOT NULL,
	"passenger_details" jsonb DEFAULT '[]',
	"special_requirements" text,
	"contact_info" jsonb NOT NULL,
	"preferences" jsonb DEFAULT '{}',
	"status" varchar(50) DEFAULT 'submitted',
	"total_price" numeric(10, 2),
	"obc_amount" numeric(10, 2),
	"commission" numeric(10, 2),
	"notes" text,
	"quote_expires_at" timestamp,
	"quoted_at" timestamp,
	"booked_at" timestamp,
	"is_urgent" boolean DEFAULT false,
	"source" varchar(50) DEFAULT 'website',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"search_criteria" jsonb NOT NULL,
	"alert_enabled" boolean DEFAULT false,
	"alert_frequency" varchar(20) DEFAULT 'weekly',
	"last_checked" timestamp,
	"last_notified" timestamp,
	"results_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cabin_categories" ADD CONSTRAINT "cabin_categories_ship_id_ships_id_fk" FOREIGN KEY ("ship_id") REFERENCES "ships"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alternative_sailings" ADD CONSTRAINT "alternative_sailings_base_cruise_id_cruises_id_fk" FOREIGN KEY ("base_cruise_id") REFERENCES "cruises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alternative_sailings" ADD CONSTRAINT "alternative_sailings_alternative_cruise_id_cruises_id_fk" FOREIGN KEY ("alternative_cruise_id") REFERENCES "cruises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cruises" ADD CONSTRAINT "cruises_cruise_line_id_cruise_lines_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "cruise_lines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cruises" ADD CONSTRAINT "cruises_ship_id_ships_id_fk" FOREIGN KEY ("ship_id") REFERENCES "ships"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cruises" ADD CONSTRAINT "cruises_embark_port_id_ports_id_fk" FOREIGN KEY ("embark_port_id") REFERENCES "ports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cruises" ADD CONSTRAINT "cruises_disembark_port_id_ports_id_fk" FOREIGN KEY ("disembark_port_id") REFERENCES "ports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ships" ADD CONSTRAINT "ships_cruise_line_id_cruise_lines_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "cruise_lines"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "regions" ADD CONSTRAINT "regions_parent_region_id_regions_id_fk" FOREIGN KEY ("parent_region_id") REFERENCES "regions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "itineraries" ADD CONSTRAINT "itineraries_port_id_ports_id_fk" FOREIGN KEY ("port_id") REFERENCES "ports"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "cheapest_pricing" ADD CONSTRAINT "cheapest_pricing_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing" ADD CONSTRAINT "pricing_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "cruises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
