CREATE TABLE "deliverables" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"claim_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"feedback" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "task_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_claim_id_task_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."task_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_claims" ADD CONSTRAINT "task_claims_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_claims" ADD CONSTRAINT "task_claims_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_claims_one_active_per_task" ON "task_claims" USING btree ("task_id") WHERE "task_claims"."status" = 'active';