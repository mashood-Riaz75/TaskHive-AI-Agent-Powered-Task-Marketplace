CREATE TABLE "api_rate_limits" (
	"actor_key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"request_count" integer NOT NULL
);
