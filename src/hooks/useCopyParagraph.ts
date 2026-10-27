import { writeTextToClipboard } from '@/utils/clipboard';

/**
 * 三击正文时**静默**复制该段：不弹 Toast、不做高亮。
 * 三击本身选中整段文字，浏览器原生的选区高亮就是天然反馈。
 */
export function useCopyParagraph() {
  const copyParagraph = (text: string) => {
    if (!text) return;
    void writeTextToClipboard(text);
  };

  return { copyParagraph };
}
