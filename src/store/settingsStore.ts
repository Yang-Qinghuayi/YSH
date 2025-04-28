import { defineStore } from 'pinia';
import type { SystemSettings } from '@/types/settings';
import type { EnvConfigType } from '@/services/environment';

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SystemSettings>({} as SystemSettings);
  const isFontLayoutSettingsDialogOpen = ref(false);
  const isFontLayoutSettingsGlobal = ref(true);

  const setSettings = (newSettings: SystemSettings) => {
    settings.value = newSettings;
  };

  const saveSettings = async (envConfig: EnvConfigType, newSettings: SystemSettings) => {
    const appService = await envConfig.getAppService();
    await appService.saveSettings(newSettings);
  };

  const setFontLayoutSettingsDialogOpen = (open: boolean) => {
    isFontLayoutSettingsDialogOpen.value = open;
  };

  const setFontLayoutSettingsGlobal = (global: boolean) => {
    isFontLayoutSettingsGlobal.value = global;
  };

  return {
    settings,
    isFontLayoutSettingsDialogOpen,
    isFontLayoutSettingsGlobal,
    setSettings,
    saveSettings,
    setFontLayoutSettingsDialogOpen,
    setFontLayoutSettingsGlobal,
  };
});
