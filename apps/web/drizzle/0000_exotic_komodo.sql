CREATE TABLE `audit_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`url` text NOT NULL,
	`agent_score` integer NOT NULL,
	`mode` text DEFAULT 'quick' NOT NULL,
	`escalated` integer DEFAULT false NOT NULL,
	`cost_usd` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`result_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credits` (
	`user_id` text PRIMARY KEY NOT NULL,
	`quick_remaining` integer DEFAULT 50 NOT NULL,
	`deep_remaining` integer DEFAULT 5 NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`reset_at` integer,
	`stripe_customer_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pending_deletions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`failed_at` integer NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`last_attempt_at` integer
);
--> statement-breakpoint
CREATE TABLE `task_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`url` text NOT NULL,
	`goal` text NOT NULL,
	`timeout_seconds` integer DEFAULT 300 NOT NULL,
	`success` integer NOT NULL,
	`output` text,
	`error` text,
	`steps` integer,
	`duration_ms` integer,
	`video_url` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`transcript` text,
	`created_at` integer NOT NULL
);
