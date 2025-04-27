import { inject, provide, reactive, readonly, ref, onMounted } from 'vue';
import { EnvConfigType } from '@/services/environment';
import env from '@/services/environment';
import { AppService } from '@/types/system';

// 定义 context key，防止注入冲突
const EnvSymbol = Symbol('Env');

// 定义类型
interface EnvContextType {
  envConfig: EnvConfigType;
  appService: AppService | null;
}

// 提供者
export function provideEnv() {
  const envConfig = reactive(env) as EnvConfigType;
  const appService = ref<AppService | null>(null);

  onMounted(async () => {
    appService.value = await envConfig.getAppService();
  });

  provide(EnvSymbol, {
    envConfig: readonly(envConfig),
    appService,
  });
}

// 使用者
export function useEnv() {
  const context = inject<{
    envConfig: EnvConfigType;
    appService: Ref<AppService | null>;
  }>(EnvSymbol);

  if (!context) {
    throw new Error('useEnv must be used within a provider (provideEnv must be called first)');
  }

  return context;
}
