-- Наценка к сумме материалов для итоговой цены заказа (выручка клиента).
ALTER TABLE orders
  ADD COLUMN pricing_markup_mode VARCHAR(32) NOT NULL DEFAULT 'none' COMMENT 'none|percent|fixed|coefficient|margin_on_price' AFTER total_cost,
  ADD COLUMN pricing_markup_value DECIMAL(12,4) NOT NULL DEFAULT 0 AFTER pricing_markup_mode;
