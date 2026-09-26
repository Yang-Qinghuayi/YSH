import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';

import { eventDispatcher } from './event';

export const tauriGetWindowLogicalPosition = async () => {
  const currentWindow = getCurrentWindow();
  const factor = await currentWindow.scaleFactor();
  const physicalPos = await currentWindow.outerPosition();
  return { x: physicalPos.x / factor, y: physicalPos.y / factor };
};

export const tauriHandleToggleFullScreen = async () => {
  const currentWindow = getCurrentWindow();
  const isFullscreen = await currentWindow.isFullscreen();
  const isMaximized = await currentWindow.isMaximized();
  if (isMaximized) {
    await currentWindow.unmaximize();
  } else {
    await currentWindow.setFullscreen(!isFullscreen);
  }
};

export const tauriQuitApp = async () => {
  await eventDispatcher.dispatch('quit-app');
  await exit(0);
};
