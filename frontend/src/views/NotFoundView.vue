<template>
  <main class="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-slate-900">
    <section class="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p class="text-sm font-semibold uppercase tracking-wide text-primary">Ошибка 404</p>
      <h1 class="mt-3 text-3xl font-semibold">Страница не найдена</h1>
      <p class="mt-3 text-sm text-slate-600">
        Адрес мог измениться, или страница была удалена. Вернитесь в приложение и выберите нужный раздел из меню.
      </p>
      <RouterLink
        to="/"
        class="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Вернуться в приложение
      </RouterLink>
    </section>
  </main>
</template>
