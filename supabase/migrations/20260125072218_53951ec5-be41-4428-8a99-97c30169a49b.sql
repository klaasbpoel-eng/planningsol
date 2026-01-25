-- Add start and end time to tasks
ALTER TABLE public.tasks
ADD COLUMN start_time time DEFAULT NULL,
ADD COLUMN end_time time DEFAULT NULL;

-- Add day_part to time_off_requests (morning, afternoon, full_day)
ALTER TABLE public.time_off_requests
ADD COLUMN day_part text DEFAULT 'full_day' CHECK (day_part IN ('morning', 'afternoon', 'full_day'));