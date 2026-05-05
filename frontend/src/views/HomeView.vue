<template>
  <section class="space-y-4">
    <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h1 class="text-2xl font-semibold text-slate-900">Рабочая зона</h1>
      <p class="mt-2 text-sm text-slate-600">Защищенный раздел приложения для авторизованных сотрудников.</p>
    </div>
    <HelloUI />
  </section>
</template>

<script setup lang="ts">
import HelloUI from "../components/HelloUI.vue";
</script>
