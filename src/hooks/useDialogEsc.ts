import { onMounted, onBeforeUnmount, type Ref } from 'vue'

/**
 * 按 ESC 关闭弹窗。
 * 自动跳过 IME 组合输入期间的 ESC（如拼音输入法中 ESC 用于取消候选窗）。
 *
 * @param show - 控制弹窗显隐的 ref，ESC 时置为 false
 */
export function useDialogEsc(show: Ref<boolean>) {
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && show.value && !e.isComposing) {
      e.preventDefault()
      show.value = false
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
