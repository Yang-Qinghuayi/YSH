import type { ViewSettings } from '@/types/book';

export interface TransformContext {
  bookKey: string;
  viewSettings: ViewSettings;
  content: string;
  transformers: string[];
  reversePunctuationTransform?: boolean;
}

export interface Transformer {
  name: string;
  transform: (ctx: TransformContext) => Promise<string>;
}
