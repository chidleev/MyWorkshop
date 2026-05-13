import "vue-router";

declare module "vue-router" {
  interface RouteMeta {
    /** Заголовок вкладки браузера (короткое название экрана без суффикса приложения). */
    title?: string;
  }
}
