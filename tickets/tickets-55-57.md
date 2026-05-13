# Тикет 55: Реализация эндпоинта фиксации прихода фурнитуры и обновления снимка остатка

## Описание

Приход увеличивает **`stock_snapshot`** и обновляет **`stock_snapshot_at`** до текущего времени (миллисекунды), фиксируя момент инвентаризации полки после поставки. Одновременно пишется строка журнала с типом **`Приход`**.

## Технические требования

- **Маршрутизация (`src/routes/inventoryRoutes.ts`):**
    - `POST /api/inventory/incoming`.
    - Роли: `Кладовщик`, `Закупщик`, `Руководитель`.
- **Тело:** `{ "material_id": number, "quantity": number }`, `quantity` строго положительный.
- **Транзакция:**
    - `UPDATE materials SET stock_snapshot = stock_snapshot + ?, stock_snapshot_at = CURRENT_TIMESTAMP(3) WHERE id = ?`.
    - `INSERT INTO inventory_transactions (material_id, order_id, tx_type, quantity_change) VALUES (?, NULL, 'Приход', ?)` — положительное `quantity_change`.
- **Ответ:** `{ status: "success" }`.

## Критерии приемки (DoD)

1. После прихода растёт `stock_snapshot`, обновляется `stock_snapshot_at`.
2. В журнале есть запись типа `Приход`.
3. Некорректные данные → 400.
4. Операция атомарна (транзакция).

---

# Тикет 56: Эндпоинт дефицита `GET /api/inventory/deficit`

## Описание

Отчёт строится по **физическому остатку** и опционально с учётом резерва. Бэкенд возвращает расширенный набор полей и суммарный бюджет.

## Технические требования

- **Маршрут:** `GET /api/inventory/deficit`, роли `Закупщик`, `Руководитель`.
- **Query `include_reserves`:** если `true` / `1` / `yes`, критерий дефицита применяется к величине `physical_stock + reserved_change` (эффективный остаток); иначе только к `physical_stock` (те же выражения, что в Тикете 52).
- **SELECT (суть):** для каждой номенклатуры вернуть `physical_stock`, `reserved_change`, `effective_stock`, `suggested_qty` = `ABS(...)` по выбранной метрике недостатка, `total_deficit_cost` = `suggested_qty * base_cost`; отфильтровать строки, где выбранная метрика `<= 0`; сортировка по возрастанию «запаса» (самый дефицитный сверху).
- **Корень ответа:** `{ status: "success", data: [...], total_budget }` — `total_budget` сумма `total_deficit_cost` по строкам.

## Критерии приемки (DoD)

1. Не используется устаревшее условие `WHERE current_stock < 0`.
2. Параметр `include_reserves` меняет набор возвращаемых позиций согласно правилу.
3. `total_budget` согласован с строками ответа.

---

# Тикет 57: `GET /api/inventory/transactions` с фильтрами и пагинацией

## Описание

Хронологический журнал складских операций с джойном к номенклатуре.

## Технические требования

- **Маршрут:** `GET /api/inventory/transactions`, роли `Кладовщик`, `Руководитель`.
- **Query:** `tx_type`, `order_id`, `limit` (по умолчанию 200), `offset` (по умолчанию 0).
- **SQL:** `SELECT t.id, t.tx_date, t.tx_type, t.quantity_change, t.order_id, m.article, m.name FROM inventory_transactions t JOIN materials m ON ... ORDER BY t.tx_date DESC LIMIT ? OFFSET ?`.

## Критерии приемки (DoD)

1. Фильтры и пагинация работают.
2. В ответе есть артикул и имя материала.
3. Сортировка: новые сверху.
