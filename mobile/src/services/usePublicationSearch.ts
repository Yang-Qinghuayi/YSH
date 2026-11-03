import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { ReadiumViewRef } from 'react-native-readium';
import { PublicationSearch, type SearchState } from './publicationSearch';
export function usePublicationSearch(reader: RefObject<ReadiumViewRef | null>) {
  const [state, setState] = useState<SearchState>({
    results: [],
    busy: false,
    hasMore: false,
    error: '',
    searched: false,
  });
  const search = useMemo(() => new PublicationSearch(() => reader.current, setState), [reader]);
  useEffect(() => () => search.dispose(), [search]);
  return {
    ...state,
    run: (query: string) => search.run(query),
    more: () => search.run(),
    clear: () => search.clear(),
  };
}
