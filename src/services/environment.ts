import { AppService } from "@/types/system";

declare global {
  interface Window {
    __READEST_CLI_ACCESS?: boolean;
  }
}

// @ts-ignore
const platform = import.meta.env.VITE_APP_PLATFORM;
export const isTauriAppPlatform = () => platform === "tauri";
export const isWebAppPlatform = () => platform === "web";

export const hasCli = () => window.__READEST_CLI_ACCESS === true;
export const isPWA = () =>
  window.matchMedia("(display-mode: standalone)").matches;

export interface EnvConfigType {
  getAppService: () => Promise<AppService>;
}

let nativeAppService: AppService | null = null;
const getNativeAppService = async () => {
  if (!nativeAppService) {
    const { NativeAppService } = await import("@/services/nativeAppService");
    try {
      nativeAppService = new NativeAppService();
    } catch (err) {
      throw new Error(`初始化 NativeAppService 失败: ${err}`);
    }
    await nativeAppService.loadSettings();
  }
  return nativeAppService;
};

let webAppService: AppService | null = null;
const getWebAppService = async () => {
  if (!webAppService) {
    const { WebAppService } = await import("@/services/webAppService");
    webAppService = new WebAppService();
    await webAppService.loadSettings();
  }
  return webAppService;
};

const environmentConfig: EnvConfigType = {
  getAppService: async () => {
    if (isTauriAppPlatform()) {
      return getNativeAppService();
    } else {
      return getWebAppService();
    }
  },
};

export default environmentConfig;
