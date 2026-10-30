import { punctuationTransformer } from './punctuation';
import { translateTransformer } from './translate';
import type { Transformer } from './types';

export const availableTransformers: Transformer[] = [
  punctuationTransformer,
  translateTransformer,
  // Add more transformers here
];
