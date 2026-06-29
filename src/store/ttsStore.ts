import { defineStore } from 'pinia';
import { ref } from 'vue';
import { TTSController } from '@/services/tts/TTSController';
import type { TTSMark, TTSVoicesGroup, TTSHighlightOptions } from '@/services/tts/types';
import type { FoliateView } from '@/types/view';
import { useAppService } from '@/hooks/useEnv';
import { useReaderStore } from './readerStore';
import { saveViewSettings } from '@/utils/viewSettingsHelper';

/**
 * TTS 朗读状态管理。
 *
 * 持有每本书一个 TTSController 实例（与 foliate view 绑定），把 Controller 的
 * EventTarget 事件桥接为 Pinia 响应式 state，供 Vue 组件订阅。偏好（速率/音色）
 * 同时写回 ViewSettings 走既有持久化链路。
 */
export const useTTSStore = defineStore('tts', () => {
  // Controller 实例按 bookId 索引（非响应式，纯持有）。
  const controllers = new Map<string, TTSController>();
  // 每本书的 tts-speak-mark 监听器引用，便于 dispose 时精确移除。
  const listeners = new Map<string, EventListener>();
  // 当前激活的书 id，用于全局响应式 state 的归属。
  const activeBookId = ref<string>('');

  const isPlaying = ref(false);
  const isPaused = ref(false);
  const rate = ref(1.0);
  const voiceId = ref('');
  const speakingLang = ref('');
  const voices = ref<TTSVoicesGroup[]>([]);
  const currentMark = ref<TTSMark | null>(null);
  const highlightOptions = ref<TTSHighlightOptions>({ style: 'highlight', color: 'gray' });
  const initialized = ref(false);

  const getController = (bookId: string) => controllers.get(bookId) ?? null;

  const syncState = (bookId: string) => {
    const c = getController(bookId);
    if (!c) return;
    activeBookId.value = bookId;
    isPlaying.value = c.state === 'playing';
    isPaused.value = c.state === 'paused' || c.state.endsWith('-paused');
    rate.value = c.ttsRate;
    voiceId.value = c.getVoiceId();
    speakingLang.value = c.getSpeakingLang();
  };

  const onSpeakMark = (e: Event, bookId: string) => {
    const detail = (e as CustomEvent<TTSMark>).detail;
    currentMark.value = detail || null;
    syncState(bookId);
  };

  /** 初始化某本书的 TTS Controller。在 view 创建并 setView 之后调用。 */
  const init = async (bookId: string, view: FoliateView) => {
    // 已存在则先释放旧实例。
    await dispose(bookId);

    const appService = await useAppService();
    const controller = new TTSController(appService, view, false, undefined, async (sectionIndex: number) => {
      // 跨章节朗读时让阅读视图跟随跳转。
      try {
        view.goTo(sectionIndex);
      } catch {
        // ignore navigation errors
      }
    });
    controllers.set(bookId, controller);
    activeBookId.value = bookId;

    const handler: EventListener = (e) => onSpeakMark(e, bookId);
    listeners.set(bookId, handler);
    controller.addEventListener('tts-speak-mark', handler);

    await controller.init();
    initialized.value = true;

    // 应用持久化的偏好。
    const readerStore = useReaderStore();
    const vs = readerStore.getViewSettings(bookId);
    if (vs?.ttsRate) {
      controller.ttsRate = vs.ttsRate;
      await controller.setRate(vs.ttsRate).catch(() => undefined);
    }
    if (vs?.ttsVoice) {
      const lang = view.language?.locale || '';
      await controller.setVoice(vs.ttsVoice, lang).catch(() => undefined);
    }

    syncState(bookId);
  };

  const play = async (bookId: string) => {
    const c = getController(bookId);
    if (!c) return;
    c.play();
    // play() 内部 start() 是异步的，稍后同步一次 state。
    setTimeout(() => syncState(bookId), 0);
  };

  const pause = async (bookId: string) => {
    const c = getController(bookId);
    if (!c) return;
    await c.pause();
    syncState(bookId);
  };

  const resume = async (bookId: string) => {
    const c = getController(bookId);
    if (!c) return;
    await c.resume();
    syncState(bookId);
  };

  const stop = async (bookId: string) => {
    const c = getController(bookId);
    if (!c) return;
    await c.stop();
    currentMark.value = null;
    syncState(bookId);
  };

  const forward = async (bookId: string) => {
    const c = getController(bookId);
    if (!c) return;
    await c.forward();
    syncState(bookId);
  };

  const backward = async (bookId: string) => {
    const c = getController(bookId);
    if (!c) return;
    await c.backward();
    syncState(bookId);
  };

  const setRate = async (bookId: string, newRate: number) => {
    const c = getController(bookId);
    if (!c) return;
    await c.setRate(newRate);
    rate.value = newRate;
    await saveViewSettings(bookId, 'ttsRate', newRate);
    syncState(bookId);
  };

  const setVoice = async (bookId: string, newVoiceId: string, lang: string) => {
    const c = getController(bookId);
    if (!c) return;
    await c.setVoice(newVoiceId, lang);
    voiceId.value = c.getVoiceId();
    await saveViewSettings(bookId, 'ttsVoice', newVoiceId);
    syncState(bookId);
  };

  const setLang = async (bookId: string, lang: string) => {
    const c = getController(bookId);
    if (!c) return;
    await c.setLang(lang);
    syncState(bookId);
  };

  const loadVoices = async (bookId: string, lang: string) => {
    const c = getController(bookId);
    if (!c) return [];
    const groups = await c.getVoices(lang);
    voices.value = groups;
    return groups;
  };

  const updateHighlightOptions = (bookId: string, options: TTSHighlightOptions) => {
    const c = getController(bookId);
    if (!c) return;
    c.updateHighlightOptions(options);
    highlightOptions.value = { ...options };
  };

  const reapplyHighlight = (bookId: string) => {
    const c = getController(bookId);
    c?.reapplyCurrentHighlight();
  };

  const dispose = async (bookId: string) => {
    const c = controllers.get(bookId);
    const handler = listeners.get(bookId);
    if (!c) return;
    if (handler) c.removeEventListener('tts-speak-mark', handler);
    listeners.delete(bookId);
    await c.shutdown().catch(() => undefined);
    controllers.delete(bookId);
    if (activeBookId.value === bookId) {
      isPlaying.value = false;
      isPaused.value = false;
      currentMark.value = null;
      initialized.value = false;
    }
  };

  return {
    activeBookId,
    isPlaying,
    isPaused,
    rate,
    voiceId,
    speakingLang,
    voices,
    currentMark,
    highlightOptions,
    initialized,
    init,
    play,
    pause,
    resume,
    stop,
    forward,
    backward,
    setRate,
    setVoice,
    setLang,
    loadVoices,
    updateHighlightOptions,
    reapplyHighlight,
    dispose,
    getController,
  };
});
