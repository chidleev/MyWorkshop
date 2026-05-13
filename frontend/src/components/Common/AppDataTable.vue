<script setup lang="ts">
import { computed, ref, watch } from "vue";

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  widthClass?: string;
}

const props = withDefaults(
  defineProps<{
    rows: Record<string, unknown>[];
    columns: DataTableColumn[];
    rowKey?: string | ((row: Record<string, unknown>, index: number) => string | number);
    pageSizeOptions?: number[];
    initialPageSize?: number;
    initialSortKey?: string;
    initialSortOrder?: "asc" | "desc";
    emptyText?: string;
    rowClass?: (row: Record<string, unknown>) => string;
    /** Больше отступы в ячейках и между блоками (например, заявки с сайта). */
    density?: "default" | "relaxed";
    /** Таблица не шире контейнера: без горизонтального скролла (table-fixed + min-w-0). */
    fitContainer?: boolean;
  }>(),
  {
    pageSizeOptions: () => [10, 20, 50],
    initialPageSize: 10,
    initialSortOrder: "asc",
    emptyText: "Нет данных для отображения.",
    rowKey: "id",
    density: "default",
    fitContainer: false,
  }
);

const cellPaddingClass = computed(() =>
  props.density === "relaxed" ? "px-4 py-3.5 align-top" : "px-3 py-2"
);

const headerCellPaddingClass = computed(() =>
  props.density === "relaxed" ? "px-4 py-3" : "px-3 py-2"
);

const rootStackClass = computed(() => (props.density === "relaxed" ? "space-y-4" : "space-y-3"));

const paginationWrapClass = computed(() =>
  props.density === "relaxed"
    ? "mt-4 flex items-center justify-between border-t border-slate-100 pt-4"
    : "mt-3 flex items-center justify-between"
);

const tableScrollClass = computed(() => (props.fitContainer ? "w-full overflow-x-hidden" : "overflow-x-auto"));

const tableClass = computed(() =>
  props.fitContainer ? "w-full table-fixed text-sm" : "min-w-full text-sm"
);

const cellMinClass = computed(() => (props.fitContainer ? "min-w-0 overflow-hidden" : "min-w-0"));

const pageNavButtonClass = computed(() =>
  props.density === "relaxed"
    ? "rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
    : "rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
);

const pageSize = ref(props.initialPageSize);
const currentPage = ref(1);
const sortKey = ref(props.initialSortKey ?? "");
const sortOrder = ref<"asc" | "desc">(props.initialSortOrder);

function toComparableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toComparableDate(value: unknown): number | null {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value !== "string") {
    return null;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

const sortedRows = computed(() => {
  const rows = [...props.rows];
  if (!sortKey.value) {
    return rows;
  }

  return rows.sort((a, b) => {
    const left = a[sortKey.value];
    const right = b[sortKey.value];

    const leftNumber = toComparableNumber(left);
    const rightNumber = toComparableNumber(right);
    if (leftNumber !== null && rightNumber !== null) {
      return sortOrder.value === "asc" ? leftNumber - rightNumber : rightNumber - leftNumber;
    }

    const leftDate = toComparableDate(left);
    const rightDate = toComparableDate(right);
    if (leftDate !== null && rightDate !== null) {
      return sortOrder.value === "asc" ? leftDate - rightDate : rightDate - leftDate;
    }

    const result = String(left ?? "").localeCompare(String(right ?? ""), "ru");
    return sortOrder.value === "asc" ? result : -result;
  });
});

const totalPages = computed(() => Math.max(1, Math.ceil(sortedRows.value.length / pageSize.value)));
const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return sortedRows.value.slice(start, start + pageSize.value);
});

function resolveRowKey(row: Record<string, unknown>, index: number) {
  if (typeof props.rowKey === "function") {
    return props.rowKey(row, index) as PropertyKey;
  }
  const keyValue = row[props.rowKey];
  return (keyValue as PropertyKey | undefined) ?? `${index}`;
}

function toggleSort(column: DataTableColumn) {
  if (!column.sortable) {
    return;
  }
  if (sortKey.value === column.key) {
    sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
    return;
  }
  sortKey.value = column.key;
  sortOrder.value = "asc";
}

function goToPrevPage() {
  currentPage.value = Math.max(1, currentPage.value - 1);
}

function goToNextPage() {
  currentPage.value = Math.min(totalPages.value, currentPage.value + 1);
}

watch(
  () => props.rows,
  () => {
    currentPage.value = 1;
  }
);

watch([pageSize, sortedRows], () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value;
  }
});
</script>

<template>
  <div class="mt-2" :class="rootStackClass">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-slate-600">Найдено: {{ sortedRows.length }}</p>
      <select v-model.number="pageSize" class="rounded-md border-slate-300 text-sm">
        <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }} на странице</option>
      </select>
    </div>

    <div v-if="sortedRows.length === 0" class="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">
      {{ emptyText }}
    </div>

    <div v-else class="overflow-hidden rounded-lg border border-slate-200">
      <div :class="tableScrollClass">
        <table :class="tableClass">
          <thead class="bg-slate-100 text-slate-700">
            <tr>
              <th
                v-for="column in columns"
                :key="column.key"
                :class="[
                  headerCellPaddingClass,
                  cellMinClass,
                  column.widthClass ?? '',
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                ]"
              >
                <button
                  v-if="column.sortable"
                  type="button"
                  class="inline-flex items-center gap-1 font-semibold hover:text-primary"
                  @click="toggleSort(column)"
                >
                  {{ column.label }}
                  <span v-if="sortKey === column.key" class="text-[10px] text-slate-500">
                    {{ sortOrder === "asc" ? "▲" : "▼" }}
                  </span>
                </button>
                <span v-else class="font-semibold">{{ column.label }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in pagedRows"
              :key="resolveRowKey(row, index)"
              class="border-t border-slate-200 bg-white"
              :class="rowClass ? rowClass(row) : ''"
            >
              <td
                v-for="column in columns"
                :key="column.key"
                :class="[
                  cellPaddingClass,
                  cellMinClass,
                  column.widthClass ?? '',
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                ]"
              >
                <slot :name="`cell-${column.key}`" :row="row">
                  {{ row[column.key] }}
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="sortedRows.length > 0" :class="paginationWrapClass">
      <p class="text-sm text-slate-600">Страница {{ currentPage }} из {{ totalPages }}</p>
      <div class="flex gap-2">
        <button
          type="button"
          :class="pageNavButtonClass"
          :disabled="currentPage <= 1"
          @click="goToPrevPage"
        >
          Назад
        </button>
        <button
          type="button"
          :class="pageNavButtonClass"
          :disabled="currentPage >= totalPages"
          @click="goToNextPage"
        >
          Вперёд
        </button>
      </div>
    </div>
  </div>
</template>
