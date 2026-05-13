USE my_workshop;

ALTER TABLE orders
  MODIFY COLUMN target_date DATETIME NULL;
