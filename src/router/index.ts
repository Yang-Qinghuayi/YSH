import type { App } from "vue";
import type { RouteLocation, RouteRecordRaw } from "vue-router";
import { createRouter, createWebHashHistory } from "vue-router";
import Home from "@/pages/Home.vue";
import Setting from "@/pages/setting/Setting.vue";
import Bookshelves from "@/pages/Bookshelves.vue";
import { defineAsyncComponent } from "vue";
import MusicLoader from "@/components/skeleton/MusicLoader.vue";

const musicRoutes: RouteRecordRaw[] = [
  // {
  //   path: "/GPT",
  //   name: "GPT",
  //   component: defineAsyncComponent({
  //     loader: () => import("../pages/GPT.vue"),
  //     loadingComponent: MusicLoader,
  //     suspensible: false,
  //   }),
  //   meta: { keepAlive: true },
  // },
  {
    path: "/bookShelves",
    name: "bookShelves",
    component: Bookshelves,
    meta: { keepAlive: true },
  },
  // {
  //   path: "/movie",
  //   name: "movie",
  //   component: () =>
  //     defineAsyncComponent({
  //       loader: () => import("../pages/MV.vue"),
  //       loadingComponent: MusicLoader,
  //       suspensible: false,
  //     }),
  //   meta: { keepAlive: true },
  // },
  // {
  //   path: "/Alist",
  //   name: "Alist",
  //   component: defineAsyncComponent({
  //     loader: () => import("../pages/Alist.vue"),
  //     loadingComponent: MusicLoader,
  //     suspensible: false,
  //   }),
  //   meta: { keepAlive: true },
  // },

  {
    path: "/music/:tab?",
    name: "music",
    component: defineAsyncComponent({
      loader: () => import("../pages/Music.vue"),
      loadingComponent: MusicLoader,
      suspensible: false,
    }),
    props: true,
    meta: { keepAlive: true, needLogin: true },
  },

  {
    path: "/daily",
    name: "daily",
    component: defineAsyncComponent({
      loader: () => import("../pages/playlists/Daily.vue"),
      loadingComponent: MusicLoader,
      suspensible: false,
    }),
    meta: { keepAlive: true, needLogin: true },
  },
  {
    path: "/album/:id",
    name: "album",
    component: defineAsyncComponent({
      loader: () => import("../pages/playlists/Album.vue"),
      loadingComponent: MusicLoader,
      suspensible: false,
    }),
    props: true,
    meta: { keepAlive: true },
  },
  {
    path: "/playlist/:id",
    name: "playlist",
    component: defineAsyncComponent({
      loader: () => import("../pages/playlists/List.vue"),
      loadingComponent: MusicLoader,
      suspensible: false,
    }),
    props: (route: RouteLocation) => ({
      id: route.params.id,
      type: route.matched[1]?.name,
    }),
    meta: { keepAlive: true },
  },

  {
    path: "/artist/:id/",
    name: "artist",
    component: defineAsyncComponent({
      loader: () => import("../pages/playlists/Artist.vue"),
      loadingComponent: MusicLoader,
      suspensible: false,
    }),
    props: true,
    meta: { keepAlive: true },
  },

  {
    path: "/queue",
    name: "queue",
    component: defineAsyncComponent({
      loader: () => import("../pages/playlists/Queue.vue"),
      loadingComponent: MusicLoader,
      suspensible: false,
    }),
    meta: {
      keepAlive: true,
    },
  },
  {
    path: "/setting",
    name: "setting",
    component: Setting,
    meta: {
      keepAlive: true,
    },
  },
  {
    path: "/search/:keywords?",
    name: "search",
    component: defineAsyncComponent({
      loader: () => import("../pages/search/index.vue"),
      loadingComponent: MusicLoader,
      suspensible: false,
    }),
    props: true,
    meta: {
      keepAlive: true,
    },
  },

  {
    path: "recent/:tab?",
    name: "recent",
    component: defineAsyncComponent({
      loader: () => import("../pages/playlists/Recent.vue"),
      loadingComponent: MusicLoader,
      suspensible: false,
    }),
    props: true,
    meta: { keepAlive: true, needLogin: true },
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
        redirect: { path: "/setting" },
      },

      {
        path: "/:pathMatch(.*)*",
        name: "FourOhFour",
        component: () => import("@/pages/404/FourOhFour.vue"),
      },
    ],
  });
  // router.beforeEach(({ meta }, from, next) => {
  //   next()
  //   // const logged = store.getters['settings/logged'];
  //   // if (meta.needLogin && !logged) {
  //   //   store.commit('app/showLogin', true);
  //   // } else {

  //   // }
  // })
  // router.afterEach((to, from, failed) => {
  //   console.log(failed)
  // })
  app.use(router);
  return router;
}
