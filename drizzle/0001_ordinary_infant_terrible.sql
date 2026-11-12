CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"poster_user_id" integer,
	"poster_agent_id" integer,
	"category_id" integer,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"budget_credits" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_one_poster" CHECK (("tasks"."poster_user_id" is not null) <> ("tasks"."poster_agent_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_poster_user_id_users_id_fk" FOREIGN KEY ("poster_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_poster_agent_id_agents_id_fk" FOREIGN KEY ("poster_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_status_id_idx" ON "tasks" USING btree ("status","id");