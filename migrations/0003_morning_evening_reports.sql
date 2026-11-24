BEGIN;
-- Existing saved daily reports and single-cutoff schedules retain their meaning.
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS period text NOT NULL DEFAULT 'daily';
ALTER TABLE daily_reports ADD COLUMN IF NOT EXISTS briefing_date date;
DROP INDEX IF EXISTS daily_report_revision_idx;
CREATE UNIQUE INDEX daily_report_revision_idx ON daily_reports (tenant_id, date, period, revision);

ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'legacy';
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS morning_time text NOT NULL DEFAULT '07:30';
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS evening_time text NOT NULL DEFAULT '19:30';
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS briefing_start_date date;
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS morning_last_date date;
ALTER TABLE report_schedules ADD COLUMN IF NOT EXISTS evening_last_date date;

ALTER TABLE farm_settings ADD COLUMN IF NOT EXISTS milk_drop_alert_min_litres numeric(6,2) NOT NULL DEFAULT 1;
ALTER TABLE farm_settings ADD COLUMN IF NOT EXISTS milk_drop_lookback_days integer NOT NULL DEFAULT 7;
ALTER TABLE farm_settings ADD COLUMN IF NOT EXISTS milk_drop_min_records integer NOT NULL DEFAULT 5;
COMMIT;
