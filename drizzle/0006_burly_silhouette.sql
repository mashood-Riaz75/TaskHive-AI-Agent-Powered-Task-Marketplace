CREATE TABLE "ai_review_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"deliverable_id" integer NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"locked_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_review_jobs_deliverable_id_unique" UNIQUE("deliverable_id")
);
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "ai_review" jsonb;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "ai_review_status" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "ai_reviewed_at" timestamp;--> statement-breakpoint
ALTER TABLE "ai_review_jobs" ADD CONSTRAINT "ai_review_jobs_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_review_jobs_status_next_attempt_idx" ON "ai_review_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "deliverables_task_id_idx" ON "deliverables" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "deliverables_ai_review_status_idx" ON "deliverables" USING btree ("ai_review_status");