import { mdiVolumeHigh, mdiVolumeLow, mdiVolumeMedium, mdiShuffleVariant, mdiShuffle, mdiVolumeMute } from '@mdi/js'
import { storeToRefs } from 'pinia'

import { usePlayer } from '@/player/player'
import { PLAY_MODE, usePlayerStore } from '@/store/player'
import { usePlayQueueStore } from '@/store/playQueue'
import { mdiRepeat, mdiRepeatOff, mdiRepeatOnce } from '@/util/icons'

import useInForeground from './useInForeground'
export default () => {
  const player = usePlayer()
  const playerStore = usePlayerStore()
  const playQueueStore = usePlayQueueStore()
  const { isActive: isQueue } = useInForeground('queue')
  const router = useRouter()

  const { isCurrentFm, playing, track, loadingTrack, playMode, shuffle, volume, showPipLyric } =
    storeToRefs(playerStore)

  const modeIcon = computed(() => {
    return (
      {
        [PLAY_MODE.NORMAL]: mdiRepeatOff,
        [PLAY_MODE.SHUFFLE]: mdiShuffle,
      }[playMode.value as string] ?? mdiRepeatOff
    )
  })
  const repeatOn = computed(() => {
    return [PLAY_MODE.REPEAT, PLAY_MODE.REPEAT_ONCE].includes(playMode.value)
  })
  // 音量icon状态
  const volumeIcon = computed(() => {
    if (volume.value === 0) {
      return mdiVolumeMute
    } else if (volume.value > 0 && volume.value <= 0.3) {
      return mdiVolumeLow
    } else if (volume.value > 0.3 && volume.value <= 0.6) {
      return mdiVolumeMedium
    } else {
      return mdiVolumeHigh
    }
  })
  const shuffleIcon = computed(() => {
    return mdiShuffle
  })
  const isProgram = computed(() => track.value?.source?.fromType === 'program')
  const prev = () => {
    player.prev()
  }
  const next = () => {
    if (isCurrentFm.value) {
      player.nextFm()
    } else {
      player.next()
    }
  }
  const toggle = () => {
    player.togglePlay()
  }
  const toggleMode = () => {
    const mode = playMode.value as string
    toggleShuffle()

    if (mode === PLAY_MODE.NORMAL) {
      playMode.value = PLAY_MODE.SHUFFLE
    } else if (mode === PLAY_MODE.SHUFFLE) {
      playMode.value = PLAY_MODE.NORMAL
    }
  }
  function toggleShuffle() {
    if (shuffle.value) {
      playQueueStore.unShuffle()
      shuffle.value = false
    } else {
      playQueueStore.shuffle()
      shuffle.value = true
    }
  }
  function togglePlayingQueue() {
    if (isQueue.value) {
      router.back()
    } else {
      router.push('/queue')
    }
  }
  // 桌面歌词
  function togglePipLyric() {
    if (!showPipLyric.value) {
      player.pipLyric?.enter()
    } else {
      player.pipLyric?.leave()
    }
  }
  player.pipLyric!.onLeave = function () {
    console.log('on leave')
    showPipLyric.value = false
  }
  player.pipLyric!.onEnter = function () {
    console.log('on enter')
    showPipLyric.value = true
  }
  return {
    prev,
    next,
    toggle,
    toggleShuffle,
    toggleMode,
    togglePlayingQueue,
    togglePipLyric,
    isQueue,
    showPipLyric,
    volume,
    volumeIcon,
    playing,
    track,
    isCurrentFm,
    isProgram,
    loadingTrack,
    playMode,
    repeatOn,
    modeIcon,
    shuffle,
    shuffleIcon,
  }
}
