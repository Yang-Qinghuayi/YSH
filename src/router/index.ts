import type { App } from "vue";
import type { RouteLocation, RouteRecordRaw } from "vue-router";
import { createRouter, createWebHashHistory } from "vue-router";
import Home from "@/pages/Home.vue";
import Setting from "@/pages/setting/Setting.vue";
import Library from "@/pages/library/Library.vue";
import Book from "@/pages/book/book.vue";

const musicRoutes: RouteRecordRaw[] = [
  {
    path: "/book",
    name: "book",
    component: Book,
  },
  {
    path: "/library",
    name: "library",
    component: Library,
  },
  {
    path: "/setting",
    name: "setting",
    component: Setting,
  },
  {
    path: "/letter",
    name: "letter",
    component: () => import("@/pages/letter/index.vue"),
  },
  {
    path: "/novel",
    name: "novel",
    component: () => import("@/pages/novel/index.vue"),
  },
];

export function useRouter(app: App) {
  const router = createRouter({
    history: createWebHashHistory(),
    scrollBehavior: (to, from, savedPosition) =>
      savedPosition || ({ x: 0, y: 0 } as any),
    routes: [
      {
        path: "/",
        name: "Home",
        component: Home,
        children: musicRoutes,
        redirect: { path: "/library" },
      },

      {
        path: "/:pathMatch(.*)*",
        name: "FourOhFour",
        component: () => import("@/pages/404/FourOhFour.vue"),
      },
    ],
  });
  app.use(router);
  return router;
}
