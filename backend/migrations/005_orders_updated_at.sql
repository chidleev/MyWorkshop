-- Время последнего изменения строки заказа (для UI «Обновлён» и аудита).
ALTER TABLE orders
  ADD COLUMN updated_at DATETIME(3) NULL AFTER created_at;

UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE orders
  MODIFY COLUMN updated_at DATETIME(3) NOT NULL
    DEFAULT CURRENT_TIMESTAMP(3)
    ON UPDATE CURRENT_TIMESTAMP(3);
