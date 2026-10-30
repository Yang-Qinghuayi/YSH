import type { Ref } from 'vue';
import { onMounted, onUnmounted, watch } from 'vue';

import type { FoliateView } from '@/types/view';

interface FoliateEventHandler {
  onLoad?: (event: Event) => void;
  onRelocate?: (event: Event) => void;
  onLinkClick?: (event: Event) => void;
  onRendererRelocate?: (event: Event) => void;
  onDrawAnnotation?: (event: Event) => void;
  onShowAnnotation?: (event: Event) => void;
}

export const useFoliateEvents = (view: Ref<FoliateView | null>, handlers?: FoliateEventHandler) => {
  const attachEvents = (viewInstance: FoliateView) => {
    if (!viewInstance) return;
    if (handlers?.onLoad) viewInstance.addEventListener('load', handlers.onLoad);
    if (handlers?.onRelocate) viewInstance.addEventListener('relocate', handlers.onRelocate);
    if (handlers?.onLinkClick) viewInstance.addEventListener('link', handlers.onLinkClick);
    if (handlers?.onRendererRelocate) {
      viewInstance.renderer?.addEventListener('relocate', handlers.onRendererRelocate);
    }
    if (handlers?.onDrawAnnotation) {
      viewInstance.addEventListener('draw-annotation', handlers.onDrawAnnotation);
    }
    if (handlers?.onShowAnnotation) {
      viewInstance.addEventListener('show-annotation', handlers.onShowAnnotation);
    }
  };

  const detachEvents = (viewInstance: FoliateView) => {
    if (!viewInstance) return;
    if (handlers?.onLoad) viewInstance.removeEventListener('load', handlers.onLoad);
    if (handlers?.onRelocate) viewInstance.removeEventListener('relocate', handlers.onRelocate);
    if (handlers?.onLinkClick) viewInstance.removeEventListener('link', handlers.onLinkClick);
    if (handlers?.onRendererRelocate) {
      viewInstance.renderer?.removeEventListener('relocate', handlers.onRendererRelocate);
    }
    if (handlers?.onDrawAnnotation) {
      viewInstance.removeEventListener('draw-annotation', handlers.onDrawAnnotation);
    }
    if (handlers?.onShowAnnotation) {
      viewInstance.removeEventListener('show-annotation', handlers.onShowAnnotation);
    }
  };

  let currentView: FoliateView | null = null;

  watch(view, (newView, oldView) => {
    if (oldView) {
      detachEvents(oldView);
    }
    if (newView) {
      attachEvents(newView);
    }
    currentView = newView;
  });

  onMounted(() => {
    if (view.value) {
      attachEvents(view.value);
      currentView = view.value;
    }
  });

  onUnmounted(() => {
    if (currentView) {
      detachEvents(currentView);
    }
  });
};
