import type {
  BookFont,
  BookLayout,
  BookSearchConfig,
  BookStyle,
  ViewConfig,
  ViewSettings,
} from '@/types/book';
import type { ReadSettings, SystemSettings } from '@/types/settings';
import { getDefaultMaxBlockSize, getDefaultMaxInlineSize } from '@/utils/config';
import { stubTranslation as _ } from '@/utils/misc';

export const LOCAL_BOOKS_SUBDIR = 'YSH/Books';
export const CLOUD_BOOKS_SUBDIR = 'YSH/Books';

export const SUPPORTED_FILE_EXTS = [
  'epub',
  'mobi',
  'azw',
  'azw3',
  'fb2',
  'zip',
  'cbz',
  'pdf',
  'txt',
];
export const FILE_ACCEPT_FORMATS = SUPPORTED_FILE_EXTS.map((ext) => `.${ext}`).join(', ');
export const BOOK_UNGROUPED_NAME = '';
export const BOOK_UNGROUPED_ID = '';

export const DEFAULT_SYSTEM_SETTINGS: Partial<SystemSettings> = {
  autoImportBooksOnOpen: false,
};

export const DEFAULT_READSETTINGS: ReadSettings = {
  sideBarWidth: '15%',
  isSideBarPinned: true,
  notebookWidth: '25%',
  isNotebookPinned: false,
  autohideCursor: true,
  translateTargetLang: 'EN',

  highlightStyle: 'highlight',
  highlightStyles: {
    highlight: 'yellow',
    underline: 'green',
    squiggly: 'blue',
  },
};

export const DEFAULT_MOBILE_READSETTINGS: Partial<ReadSettings> = {
  sideBarWidth: '25%',
  isSideBarPinned: false,
};

export const DEFAULT_BOOK_FONT: BookFont = {
  serifFont: 'Bitter',
  sansSerifFont: 'Roboto',
  monospaceFont: 'Consolas',
  defaultFont: 'Serif',
  defaultCJKFont: 'LXGW WenKai',
  defaultFontSize: 16,
  minimumFontSize: 8,
  fontWeight: 400,
};

export const DEFAULT_BOOK_LAYOUT: BookLayout = {
  marginPx: 44,
  gapPercent: 5,
  scrolled: false,
  disableClick: false,
  swapClickArea: false,
  continuousScroll: false,
  maxColumnCount: 1,
  maxInlineSize: getDefaultMaxInlineSize(),
  maxBlockSize: getDefaultMaxBlockSize(),
  animated: false,
  writingMode: 'auto',
  vertical: false,
  rtl: false,
  doubleBorder: false,
  borderColor: 'red',
  showHeader: true,
  showFooter: true,
  showBarsOnScroll: false,
};

export const DEFAULT_BOOK_STYLE: BookStyle = {
  zoomLevel: 100,
  paragraphMargin: 1,
  lineHeight: 1.6,
  wordSpacing: 0,
  letterSpacing: 0,
  textIndent: 0,
  fullJustification: true,
  hyphenation: true,
  invert: false,
  theme: 'light',
  overrideFont: false,
  overrideLayout: true,
  userStylesheet: '',
};

export const DEFAULT_MOBILE_VIEW_SETTINGS: Partial<ViewSettings> = {
  fullJustification: false,
  animated: true,
  defaultFont: 'Sans-serif',
};

export const DEFAULT_CJK_VIEW_SETTINGS: Partial<ViewSettings> = {
  fullJustification: true,
  textIndent: 2,
};

export const DEFAULT_VIEW_CONFIG: ViewConfig = {
  sideBarTab: 'toc',
  uiLanguage: '',
};

export const DEFAULT_BOOK_SEARCH_CONFIG: BookSearchConfig = {
  scope: 'book',
  matchCase: false,
  matchWholeWords: false,
  matchDiacritics: false,
};

export const SYSTEM_SETTINGS_VERSION = 1;

export const SERIF_FONTS = [
  'Bitter',
  'Literata',
  'Merriweather',
  'Vollkorn',
  'Georgia',
  'Times New Roman',
];

export const CJK_SERIF_FONTS = [
  _('LXGW WenKai GB Screen'),
  _('LXGW WenKai TC'),
  _('GuanKiapTsingKhai-T'),
];

export const CJK_SANS_SERIF_FONTS = ['Noto Sans SC', 'Noto Sans TC'];

export const SANS_SERIF_FONTS = ['Roboto', 'Noto Sans', 'Open Sans', 'Helvetica', 'Arial'];

export const MONOSPACE_FONTS = ['Fira Code', 'Lucida Console', 'Consolas', 'Courier New'];

export const FALLBACK_FONTS = ['MiSans L3'];

export const WINDOWS_FONTS = [
  'Arial',
  'Arial Black',
  'Bahnschrift',
  'Calibri',
  'Cambria',
  'Cambria Math',
  'Candara',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Corbel',
  'Courier New',
  'Ebrima',
  'FangSong',
  'Franklin Gothic Medium',
  'Gabriola',
  'Gadugi',
  'Georgia',
  'Heiti',
  'HoloLens MDL2 Assets',
  'Impact',
  'Ink Free',
  'Javanese Text',
  'KaiTi',
  'Leelawadee UI',
  'Lucida Console',
  'Lucida Sans Unicode',
  'LXGW WenKai GB Screen',
  'LXGW WenKai',
  'LXGW WenKai TC',
  'Malgun Gothic',
  'Marlett',
  'Microsoft Himalaya',
  'Microsoft JhengHei',
  'Microsoft New Tai Lue',
  'Microsoft PhagsPa',
  'Microsoft Sans Serif',
  'Microsoft Tai Le',
  'Microsoft YaHei',
  'Microsoft Yi Baiti',
  'MingLiU',
  'MingLiU-ExtB',
  'Mongolian Baiti',
  'MS Gothic',
  'MS Mincho',
  'MV Boli',
  'Myanmar Text',
  'Nirmala UI',
  'Noto Serif JP',
  'NSimSun',
  'Palatino Linotype',
  'PMingLiU',
  'Segoe MDL2 Assets',
  'Segoe Print',
  'Segoe Script',
  'Segoe UI',
  'Segoe UI Historic',
  'Segoe UI Emoji',
  'Segoe UI Symbol',
  'SimHei',
  'SimSun',
  'SimSun-ExtB',
  'Sitka',
  'Sylfaen',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'XiHeiti',
  'Yu Gothic',
  'Yu Mincho',
];

export const MACOS_FONTS = [
  'American Typewriter',
  'Andale Mono',
  'Arial',
  'Arial Black',
  'Arial Narrow',
  'Arial Rounded MT Bold',
  'Arial Unicode MS',
  'Avenir',
  'Avenir Next',
  'Avenir Next Condensed',
  'Baskerville',
  'BiauKai',
  'Big Caslon',
  'Bodoni 72',
  'Bodoni 72 Oldstyle',
  'Bodoni 72 Smallcaps',
  'Bradley Hand',
  'Brush Script MT',
  'Chalkboard',
  'Chalkboard SE',
  'Chalkduster',
  'Charter',
  'Cochin',
  'Comic Sans MS',
  'Copperplate',
  'Courier',
  'Courier New',
  'Didot',
  'DIN Alternate',
  'DIN Condensed',
  'FangSong',
  'Futura',
  'Geneva',
  'Georgia',
  'Gill Sans',
  'Heiti SC',
  'Heiti TC',
  'Helvetica',
  'Helvetica Neue',
  'Herculanum',
  'Hiragino Sans',
  'Hiragino Mincho',
  'Hoefler Text',
  'Impact',
  'Kaiti SC',
  'Kaiti TC',
  'Kozuka Gothic Pro',
  'Kozuka Mincho Pro',
  'Lucida Grande',
  'Luminari',
  'LXGW WenKai',
  'LXGW WenKai GB Screen',
  'LXGW WenKai TC',
  'Marker Felt',
  'Menlo',
  'Microsoft Sans Serif',
  'Monaco',
  'Noteworthy',
  'Noto Serif JP',
  'Optima',
  'Palatino',
  'Papyrus',
  'PingFang HK',
  'PingFang SC',
  'PingFang TC',
  'Phosphate',
  'Rockwell',
  'Savoye LET',
  'SignPainter',
  'Skia',
  'Snell Roundhand',
  'Songti SC',
  'Songti TC',
  'STFangsong',
  'STKaiti',
  'STSong',
  'STXihei',
  'Tahoma',
  'Times',
  'Times New Roman',
  'Trattatello',
  'Trebuchet MS',
  'Verdana',
  'XiHeiti',
  'Yu Mincho',
  'Zapfino',
];

export const LINUX_FONTS = [
  'Arial',
  'Cantarell',
  'Comic Sans MS',
  'Courier New',
  'DejaVu Sans',
  'DejaVu Sans Mono',
  'DejaVu Serif',
  'Droid Sans',
  'Droid Sans Mono',
  'FangSong',
  'FreeMono',
  'FreeSans',
  'FreeSerif',
  'Georgia',
  'Heiti',
  'Impact',
  'Kaiti',
  'Liberation Mono',
  'Liberation Sans',
  'Liberation Serif',
  'LXGW WenKai',
  'LXGW WenKai GB Screen',
  'LXGW WenKai TC',
  'Noto Mono',
  'Noto Sans',
  'Noto Sans JP',
  'Noto Sans CJK SC',
  'Noto Sans CJK TC',
  'Noto Serif',
  'Noto Serif JP',
  'Noto Serif CJK SC',
  'Noto Serif CJK TC',
  'Open Sans',
  'Poppins',
  'Sazanami Gothic',
  'Sazanami Mincho',
  'Source Han Sans',
  'Source Han Serif',
  'Times New Roman',
  'Ubuntu',
  'Ubuntu Mono',
  'WenQuanYi Micro Hei',
  'WenQuanYi Zen Hei',
  'XiHeiti',
];

export const IOS_FONTS = [
  'Avenir',
  'Avenir Next',
  'Courier',
  'Courier New',
  'FangSong',
  'Georgia',
  'Heiti',
  'Helvetica',
  'Helvetica Neue',
  'Hiragino Mincho',
  'Hiragino Sans',
  'Kaiti',
  'LXGW WenKai',
  'LXGW WenKai GB Screen',
  'LXGW WenKai TC',
  'Palatino',
  'PingFang SC',
  'PingFang TC',
  'San Francisco',
  'SF Pro Display',
  'SF Pro Rounded',
  'SF Pro Text',
  'Songti',
  'Times New Roman',
  'Verdana',
  'XiHeiti',
];

export const ANDROID_FONTS = [
  'Arial',
  'Droid Sans',
  'Droid Serif',
  'FangSong',
  'FZLanTingHei',
  'Georgia',
  'Heiti',
  'Kaiti',
  'LXGW WenKai',
  'LXGW WenKai GB Screen',
  'LXGW WenKai TC',
  'Noto Sans',
  'Noto Sans CJK',
  'Noto Sans JP',
  'Noto Serif',
  'Noto Serif CJK',
  'Noto Serif JP',
  'PingFang SC',
  'Roboto',
  'Source Han Sans',
  'Source Han Serif',
  'STHeiti',
  'STSong',
  'Tahoma',
  'Verdana',
  'XiHeiti',
];

export const CJK_NAMES_PATTENS = /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;
export const CJK_EXCLUDE_PATTENS = new RegExp(
  ['AlBayan', 'STIX', 'Kailasa', 'ITCTT', 'Luminari', 'Myanmar'].join('|'),
  'i'
);
export const CJK_FONTS_PATTENS = new RegExp(
  [
    'CJK',
    'TC$',
    'SC$',
    'HK',
    'JP',
    'TW',
    'Sim',
    'Kai',
    'Hei',
    'Yan',
    'Min',
    'Khai',
    'Yuan',
    'Song',
    'Ming',
    'FZ',
    'FangZheng',
    'WenQuanYi',
    'PingFang',
    'Hiragino',
    'Meiryo',
    'Source\\s?Han',
    'Yu\\s?Gothic',
    'Yu\\s?Mincho',
    'Mincho',
    'Nanum',
    'Malgun',
    'Gulim',
    'Dotum',
    'Batang',
    'Gungsuh',
    'OPPO sans',
    'MiSans',
    'Fallback',
  ].join('|'),
  'i'
);

export const MAX_ZOOM_LEVEL = 500;
export const MIN_ZOOM_LEVEL = 50;
export const ZOOM_STEP = 10;

export const DOUBLE_CLICK_INTERVAL_THRESHOLD_MS = 250;
export const DISABLE_DOUBLE_CLICK_ON_MOBILE = true;
export const LONG_HOLD_THRESHOLD = 500;

export const TRANSLATED_LANGS = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  pt: 'Português',
  ru: 'Русский',
  ar: 'العربية',
  el: 'Ελληνικά',
  uk: 'Українська',
  pl: 'Polski',
  tr: 'Türkçe',
  hi: 'हिन्दी',
  id: 'Bahasa Indonesia',
  vi: 'Tiếng Việt',
  'zh-CN': '简体中文',
  'zh-TW': '正體中文',
};

export const SUPPORTED_LANGS: Record<string, string> = { ...TRANSLATED_LANGS, zh: '中文' };
