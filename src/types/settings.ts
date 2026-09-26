import type { HighlightColor, HighlightStyle, ViewSettings } from './book';

export interface ReadSettings {
  sideBarWidth: string;
  isSideBarPinned: boolean;
  notebookWidth: string;
  isNotebookPinned: boolean;
  autohideCursor: boolean;
  translateTargetLang: string;

  highlightStyle: HighlightStyle;
  highlightStyles: Record<HighlightStyle, HighlightColor>;
}

export interface SystemSettings {
  version: number;
  localBooksDir: string;

  autoImportBooksOnOpen: boolean;

  globalReadSettings: ReadSettings;
  globalViewSettings: ViewSettings;
}
