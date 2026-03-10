-- Extend day_part to allow custom hour ranges (e.g. '08:00-17:00')
ALTER TABLE time_off_requests DROP CONSTRAINT IF EXISTS time_off_requests_day_part_check;
