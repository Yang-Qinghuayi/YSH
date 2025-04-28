import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSidebarStore = defineStore('sidebar', () => {
  const sideBarBookKey = ref<string | null>(null);
  const sideBarWidth = ref('');
  const isSideBarVisible = ref(false);
  const isSideBarPinned = ref(false);

  const setSideBarBookKey = (key: string) => {
    sideBarBookKey.value = key;
  };

  const setSideBarWidth = (width: string) => {
    sideBarWidth.value = width;
  };

  const toggleSideBar = () => {
    isSideBarVisible.value = !isSideBarVisible.value;
  };

  const toggleSideBarPin = () => {
    isSideBarPinned.value = !isSideBarPinned.value;
  };

  const setSideBarVisible = (visible: boolean) => {
    isSideBarVisible.value = visible;
  };

  const setSideBarPin = (pinned: boolean) => {
    isSideBarPinned.value = pinned;
  };

  return {
    sideBarBookKey,
    sideBarWidth,
    isSideBarVisible,
    isSideBarPinned,
    setSideBarBookKey,
    setSideBarWidth,
    toggleSideBar,
    toggleSideBarPin,
    setSideBarVisible,
    setSideBarPin,
  };
});
