-- migrate-legacy.sql：将存量 5 道题标记为 PUBLISHED
UPDATE question SET status = 'PUBLISHED', source = 'MANUAL' WHERE status IS NULL;
