import type { App } from "vue";
import type { RouteLocation, RouteRecordRaw } from "vue-router";
import { createRouter, createWebHashHistory } from "vue-router";
import Home from "@/pages/Home.vue";
import Setting from "@/pages/setting/Setting.vue";
import Bookshelves from "@/pages/bookshelves/index.vue";
import Book from "@/pages/book/index.vue";

const musicRoutes: RouteRecordRaw[] = [
  {
    path: "/book",
    name: "book",
    component: Book,
  },
  {
    path: "/bookShelves",
    name: "bookShelves",
    component: Bookshelves,
  },
  {
    path: "/setting",
    name: "setting",
    component: Setting,
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
        redirect: { path: "/bookShelves" },
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
