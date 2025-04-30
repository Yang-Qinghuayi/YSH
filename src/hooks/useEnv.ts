import { inject, provide, reactive, readonly, ref, onMounted } from 'vue';
import { EnvConfigType } from '@/services/environment';
import env from '@/services/environment';
import { AppService } from '@/types/system';

// 定义 context key，防止注入冲突
export const EnvSymbol = Symbol('Env');

// 提供者
export function provideEnv() {
}

// 使用者
export function useEnv() {
  const context = inject<{
    envConfig: EnvConfigType;
    appService:Ref<AppService | null>;
  }>(EnvSymbol);

  if (!context) {
    throw new Error('useEnv must be used within a provider (provideEnv must be called first)');
  }

  return context;
}
