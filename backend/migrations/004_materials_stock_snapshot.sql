USE my_workshop;

ALTER TABLE materials ADD COLUMN stock_snapshot_at DATETIME(3) NULL AFTER current_stock;

UPDATE materials SET stock_snapshot_at = CURRENT_TIMESTAMP(3) WHERE stock_snapshot_at IS NULL;

ALTER TABLE materials CHANGE COLUMN current_stock stock_snapshot DECIMAL(10,3) NOT NULL DEFAULT 0.000;

ALTER TABLE materials MODIFY stock_snapshot_at DATETIME(3) NOT NULL;
