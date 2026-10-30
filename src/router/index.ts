import type { App } from 'vue';
import type { RouteRecordRaw } from 'vue-router';
import { createRouter, createWebHashHistory } from 'vue-router';

import Home from '@/pages/Home.vue';
import Library from '@/pages/library/Library.vue';

// 首屏只需 Home / Library；阅读器、设置、写作工作台体积大（pdf.js、CodeMirror、mcu…），
// 全部改成路由级动态 import，进入对应页面时再加载。
const Book = () => import('@/pages/book/book.vue');
const Setting = () => import('@/pages/setting/Setting.vue');

const musicRoutes: RouteRecordRaw[] = [
  {
    path: '/book',
    name: 'book',
    component: Book,
  },
  {
    path: '/library',
    name: 'library',
    component: Library,
  },
  {
    path: '/setting',
    name: 'setting',
    component: Setting,
  },
  // {
  //   path: "/letter",
  //   name: "letter",
  //   component: () => import("@/pages/letter/index.vue"),
  // },
  {
    path: '/novel',
    name: 'novel',
    component: () => import('@/pages/novel/index.vue'),
  },
];

export function useRouter(app: App) {
  const router = createRouter({
    history: createWebHashHistory(),
    scrollBehavior: (to, from, savedPosition) => savedPosition || ({ x: 0, y: 0 } as any),
    routes: [
      {
        path: '/',
        name: 'Home',
        component: Home,
        children: musicRoutes,
        redirect: { path: '/library' },
      },

      {
        path: '/:pathMatch(.*)*',
        name: 'FourOhFour',
        component: () => import('@/pages/404/FourOhFour.vue'),
      },
    ],
  });
  app.use(router);
  return router;
}
