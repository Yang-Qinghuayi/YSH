import {
  mdiCog,
  mdiBookshelf,
  mdiBookOpenVariantOutline,
  mdiEmailFastOutline,
  mdiFeather,
} from "@mdi/js";
import { useI18n } from "@/utils/i18n";

export function useNavItems() {
  const { t } = useI18n();

  const nav = computed(() => [
    {
      icon: mdiBookOpenVariantOutline,
      val: "book",
      title: "书籍",
      to: "/book",
    },
    {
      icon: mdiBookshelf,
      val: "library",
      title: t("book.bookshelf"),
      to: "/library",
    },
    {
      icon: mdiCog,
      val: "setting",
      title: t("common.setting"),
      to: "/setting",
    },
    {
      icon: mdiEmailFastOutline,
      val: "letter",
      title: "信来",
      to: "/letter",
    },
    {
      icon: mdiFeather,
      val: "novel",
      title: "写作",
      to: "/novel",
    },
  ]);

  return { nav };
}
