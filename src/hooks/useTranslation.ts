import { useI18n } from 'vue-i18n';

export type TranslationFunc = (key: string, options?: Record<string, number | string>) => string;

export const useTranslation = (namespace = 'translation'): TranslationFunc => {
  const { t } = useI18n({ useScope: 'global' });

  return (key: string, options = {}) => {
    const namespacedKey = namespace ? `${namespace}.${key}` : key;
    const translated = t(namespacedKey, options);

    // 如果翻译结果是原样 key，说明没找到翻译
    if (translated === namespacedKey) {
      return key;
    }
    return translated;
  };
};
