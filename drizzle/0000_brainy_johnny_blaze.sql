CREATE TABLE `ai_records` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`at` integer NOT NULL,
	`input` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_owner` ON `ai_records` (`owner`,`at`);--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`owner` text NOT NULL,
	`version` integer NOT NULL,
	`run_id` text NOT NULL,
	`fingerprint` text NOT NULL,
	`at` integer NOT NULL,
	`title` text NOT NULL,
	`reason` text NOT NULL,
	`read_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_alerts_dedupe` ON `alerts` (`task_id`,`version`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_alerts_owner` ON `alerts` (`owner`,`at`);--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `owners` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`owner` text NOT NULL,
	`version` integer NOT NULL,
	`at` integer NOT NULL,
	`trigger` text NOT NULL,
	`decision` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_runs_task_time` ON `runs` (`task_id`,`at`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`rule` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`next_run` integer NOT NULL,
	`last_run` integer,
	`last_alert` integer,
	`status` text DEFAULT 'ready' NOT NULL,
	`reason` text DEFAULT '等待首次检查' NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`scenario` text DEFAULT 'normal' NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`last_data` text
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_owner` ON `tasks` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_tasks_due` ON `tasks` (`enabled`,`next_run`);--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`version` integer NOT NULL,
	`rule` text NOT NULL,
	`note` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_versions_task_version` ON `versions` (`task_id`,`version`);