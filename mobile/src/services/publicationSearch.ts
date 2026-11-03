import type { ReadiumViewRef, SearchResult } from 'react-native-readium';
export interface SearchState {
  results: SearchResult[];
  busy: boolean;
  hasMore: boolean;
  error: string;
  searched: boolean;
}
const empty = (): SearchState => ({
  results: [],
  busy: false,
  hasMore: false,
  error: '',
  searched: false,
});
type SearchReader = Pick<ReadiumViewRef, 'search' | 'loadMoreSearchResults' | 'cancelSearch'>;
/** One native iterator at a time; cancellation invalidates pending callbacks. */
export class PublicationSearch {
  state = empty();
  private generation = 0;
  private locked = false;
  private active = true;
  constructor(
    private reader: () => SearchReader | null,
    private onChange: (state: SearchState) => void
  ) {}
  private emit(patch: Partial<SearchState>) {
    this.state = { ...this.state, ...patch };
    if (this.active) this.onChange(this.state);
  }
  clear() {
    this.generation++;
    this.reader()?.cancelSearch();
    this.emit({ ...empty(), busy: this.locked });
  }
  async run(query?: string) {
    const reader = this.reader();
    if (
      !this.active ||
      this.locked ||
      !reader ||
      (query === undefined && !this.state.hasMore) ||
      (query !== undefined && !query.trim())
    )
      return;
    const id = ++this.generation;
    this.locked = true;
    this.emit({
      busy: true,
      error: '',
      ...(query !== undefined ? { results: [], hasMore: false } : {}),
    });
    try {
      const page =
        query !== undefined
          ? await reader.search(query.trim())
          : await reader.loadMoreSearchResults();
      if (id !== this.generation) return;
      this.emit({
        searched: true,
        hasMore: page.hasMore,
        results: query !== undefined ? page.results : [...this.state.results, ...page.results],
        error: page.isSupported ? '' : '此出版物不支持全文搜索',
      });
    } catch (error) {
      if (id === this.generation)
        this.emit({ error: `搜索失败，请重试：${String(error)}`, hasMore: false });
    } finally {
      this.locked = false;
      this.emit({ busy: false });
    }
  }
  activate() {
    this.active = true;
  }
  dispose() {
    this.active = false;
    this.generation++;
    this.reader()?.cancelSearch();
  }
}
