/**
 * 剪贴板写入（纯逻辑，便于在 node:test 下用假 navigator / document 验证）。
 *
 * 注意：正文位于 sandbox="allow-same-origin allow-scripts" 的 iframe 中
 * （见 foliate-js/paginator.js），没有剪贴板权限，所以必须在顶层文档里调用；
 * 用户激活会从 iframe 传播到父窗口，在父窗口写入是可靠的。
 */
export const writeTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.warn('[copyParagraph] clipboard.writeText failed, fallback:', error);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  } catch (error) {
    console.warn('[copyParagraph] execCommand fallback failed:', error);
    return false;
  }
};
