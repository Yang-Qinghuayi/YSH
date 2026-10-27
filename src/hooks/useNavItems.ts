import { mdiBookOpenVariantOutline, mdiBookshelf, mdiCog, mdiFeather } from '@mdi/js';
import { useRoute } from 'vue-router';

import { useReaderStore } from '@/store/readerStore';
import { useI18n } from '@/utils/i18n';

export interface NavItem {
  icon: string;
  val: string;
  title: string;
  to: string;
}

export function useNavItems() {
  const { t } = useI18n();
  const route = useRoute();
  const readerStore = useReaderStore();

  const nav = computed<NavItem[]>(() => [
    {
      icon: mdiBookOpenVariantOutline,
      val: 'book',
      title: '书籍',
      to: '/book',
    },
    {
      icon: mdiBookshelf,
      val: 'library',
      title: t('book.bookshelf'),
      to: '/library',
    },
    {
      icon: mdiCog,
      val: 'setting',
      title: t('common.setting'),
      to: '/setting',
    },
    {
      icon: mdiFeather,
      val: 'novel',
      title: '写作',
      to: '/novel',
    },
  ]);

  /**
   * 已在书籍页时再次点击「书籍」路由项，不再重复跳转，
   * 而是弹出 / 收起阅读菜单。
   * 这是原「点击正文中间弹菜单」功能的迁移入口。
   */
  const onNavItemClick = (item: NavItem) => {
    if (item.val === 'book' && route.path === item.to) {
      readerStore.switchShowMenu();
    }
  };

  return { nav, onNavItemClick };
}
