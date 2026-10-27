import { useToast } from 'vue-toastification';

import { writeTextToClipboard } from '@/utils/clipboard';
import { flashLastClickedParagraph } from '@/utils/iframeEventHandlers';

/** 点击阅读区中间时复制该段：写剪贴板 + Toast 反馈 + 短暂高亮 */
export function useCopyParagraph() {
  const toast = useToast();

  const copyParagraph = async (text: string) => {
    if (!text) return;
    const ok = await writeTextToClipboard(text);
    if (ok) {
      toast.success('已复制该段');
      flashLastClickedParagraph();
    } else {
      toast.error('复制失败');
    }
  };

  return { copyParagraph };
}
