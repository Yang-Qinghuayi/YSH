// import { useIpcRenderer } from '@vueuse/electron'
import { useToast } from "vue-toastification";

import { getSongDownloadUrl } from "@/api/song";
import { QUALITY_LEVEL, useSettingStore } from "@/store/setting";
import type { Track } from "@/types";
import { downloadFile } from "@/util/fn";


export async function useDownload(url: string, fileName?: string) {
  downloadFile(url, fileName);
}

export async function useDownloadMusic(track: Track) {
  const settingStore = useSettingStore();
  const toast = useToast();
  const br = {
    [QUALITY_LEVEL.STANDARD]: 128000,
    [QUALITY_LEVEL.HIGHER]: 320000,
    [QUALITY_LEVEL.EXHIGH]: 999000,
    [QUALITY_LEVEL.LOSSLESS]: 999000,
    [QUALITY_LEVEL.HIRES]: 999000
  }[settingStore.quality_level];
  try {
    const { data } = await getSongDownloadUrl({ id: track.id, br });
    const artistName = track.ar?.map((i) => i.name)?.join(",");
    const fileName = `${artistName} - ${track.name}.${data.type}`;
    const year = track.publishTime ? new Date(track.publishTime).getFullYear().toString() : "";
    if (!data.url) {
      toast.warning("未获取到歌曲下载链接");
      return;
    } else {
      downloadFile(data.url, fileName);
    }
  } catch (e) {
    toast.error("something_wrong");
  }
}
