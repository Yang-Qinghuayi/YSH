<template>
  <div>
    <div class="crumbs">
      <!-- 开头部分 -->
      <span @click="goBack(-1)" class="crumb">首页 </span>
      <span v-if="breadcrumbList.length"> / </span>

      <!-- 面包屑导航 -->
      <span v-for="(item, index) in breadcrumbList" :key="index" @click="goBack(index)">
        <div class="crumb">
          {{ item }}
        </div>
        <span v-if="index < breadcrumbList.length - 1"> / </span>
      </span>
    </div>

    <!-- 骨架屏 -->
    <ListSkeleton v-if="!folders.length && logged" />
    <!-- 展示文件夹 -->
    <v-card
      v-else
      @click.right.native="(event) => handleContextMenu(event, folder.name)"
      @click="goTo(folder.name)"
      color="surfaceVariant"
      flat
      class="pa-4 mt-4"
      v-for="folder in folders"
      :key="folder"
    >
      {{ folder.name }}
    </v-card>

    <!-- 登录相关 -->
    <div v-if="!logged">
      <v-text-field
        v-model="state.username"
        variant="outlined"
        density="comfortable"
        label="账号"
        :prepend-inner-icon="mdiAccount"
      >
      </v-text-field>
      <v-text-field
        v-model="state.password"
        variant="outlined"
        density="comfortable"
        :prepend-inner-icon="mdiLock"
        type="password"
        :label="$t('message.password')"
      >
      </v-text-field>

      <!-- 登录和取消按钮 -->
      <div class="d-flex justify-center mx-3 align-center">
        <v-btn color="primary" size="large" variant="tonal" class="mr-10 px-10 rounded-pill" @click="handleCancel">
          {{ $t('common.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          size="large"
          variant="tonal"
          class="mr-4 px-10 rounded-pill"
          :loading="state.loading"
          @click="handleLogin"
        >
          {{ $t('common.sign_in') }}
        </v-btn>
      </div>

      <!-- 登录提示 -->
      <div class="tips">试试 YQHW 和 123 来登录</div>
    </div>
  </div>
</template>

<script setup>
// 骨架屏
import ListSkeleton from '@/components/skeleton/ListSkeleton.vue'

// 右键相关
import { useContextMenu } from 'vuetify-ctx-menu/lib/main'
const contextMenu = useContextMenu()
const { themeName } = useCurrentTheme()

function handleContextMenu(event, name) {
  event.preventDefault()
  let option
  const { x, y } = event
  if (!(name.includes('.') && name.endsWith('.epub'))) {
    // 处理文件夹
    option = {
      theme: themeName.value,
      x: event.x,
      y: event.y,
      items: [
        {
          label: name,
        },
      ],
      offsetFooter: 64,
      customClass: 'bg-surfaceVariant',
    }
    // return
  } else
    option = {
      theme: themeName.value,
      x,
      y,
      items: [
        {
          label: '收藏到书架',
          onClick: () => {
            addBookshelves(name)
          },
        },
      ],
      offsetFooter: 64,
      customClass: 'bg-surfaceVariant',
    }
  contextMenu(option)
}
/**
 * 加入书架
 * @todo
 */
import localForage from 'localforage'
localForage.config({
  name: 'epubBooks',
})
import { useToast } from 'vue-toastification'
const toast = useToast()

let addBookshelves = async (name) => {
  let res = await fsGet(path.value + '/' + name)
  let url = getLinkByDirAndObj('/' + path.value + '/' + name, res.data)
  let { content } = await fetchText(url)
  const book = EPub(content)
  let cover = await book.loaded.cover
  let coverBlob = await book.archive.getBlob(cover)
  let metadata = await book.loaded.metadata
  let bookName = metadata.title.replace(/\(.*?\) |（.*?）/g, '')
  await localForage.setItem(bookName, { book: content, name: bookName, cover: coverBlob })
  toast.success('已收藏到书架')
}
// 登录部分
import { mdiAccount, mdiLock, mdiLogin, mdiReload } from '@mdi/js'

const state = reactive({
  username: '',
  password: '',
  loading: false,
})

import { storeToRefs } from 'pinia'

import { useAlistStore } from '@/store/alist'
const alistStore = useAlistStore()
let handleLogin = async () => {
  state.loading = true
  let loginResponse = await Login(state.username, state.password)
  if (loginResponse.code === 200) {
    alistStore.setToken(loginResponse.data.token)
    alistStore.setLogged(true)
    alistStore.setUsername(state.username)
    await getFolder()
    state.loading = false
    toast.success('登录成功')
  } else {
    state.loading = false
    toast.error('登录失败')
  }
}

let { logged } = storeToRefs(alistStore)

let handleCancel = () => {
  state.username = ''
  state.password = ''
}

import { getLinkByDirAndObj } from '@/hooks/useLink'

import { fsGet, Login, fsList, fetchText } from '@/api/alist'

let folders = ref([])
let breadcrumbList = ref([])
let path = computed(() => {
  return breadcrumbList.value.join('/')
})
/**
 * 用于在挂载之前获得数据
 * 获得文件夹的数据
 * 即用户的网盘数据
 */
let getFolder = async () => {
  folders.value = []
  folders.value = (await fsList(path.value)).data.content
}
getFolder()

let goTo = async (name) => {
  // 如果是文件
  if (name.endsWith('.mp4') || name.endsWith('.mkv')) {
    handleMovie(name)
    return
  }

  // 如果是文件夹
  breadcrumbList.value.push(name)
  await getFolder()
}

// 处理文件
let handleFile = async (name) => {
  // 如果是视频文件
  if (name.endsWith('.mp4') || name.endsWith('.mkv')) {
    handleMovie(name)
    return
  }
  // 如果是epub文件
  if (name.endsWith('.epub')) {
    let res = await fsGet(path.value + '/' + name)
    let url = getLinkByDirAndObj('/' + path.value + '/' + name, res.data)
    let { content } = await fetchText(url)
    await handleBook(content)
  }
}

import EPub from 'epubjs'
import { useBookStore } from '@/store/book'
const bookStore = useBookStore()
import { useRouter } from 'vue-router'
const router = useRouter()

import { useMovieStore } from '@/store/movie'
const movieStore = useMovieStore()

function handleMovie(name) {
  const pathPrefix = `/${path.value}/`
  let pathTemp = pathPrefix + name

  // 把folders转换成数组
  let arr = []
  for (let i = 0; i < folders.value.length; i++) {
    arr.push(folders.value[i].name)
  }

  const filteredFolders = arr
    .filter((name) => name.endsWith('.mp4') || name.endsWith('.mkv'))
    .map((name) => `${pathPrefix}${name}`)
  movieStore.SET_MovieAlbum(filteredFolders)
  movieStore.SET_MoviePath(pathTemp)
  router.push('/movie')
}

async function handleBook(file) {
  const book = EPub(file)
  bookStore.SET_BOOK(book)
  router.push('/book')
}

// 处理面包屑的点击事件
const goBack = (index) => {
  breadcrumbList.value = breadcrumbList.value.slice(0, index + 1)
  getFolder()
}
</script>
<style scoped>
.tips {
  border: #efe6dd 2px solid;
  border-radius: 16px;
  text-align: center;
  margin: auto;
  color: #c5741c;
  width: 20vw;
  height: 10vh;
  line-height: 10vh;
  margin-top: 10vh;
}

.folder {
  background-color: #efe6dd;
  padding: 20px;
  margin: 10px;
  border-radius: 16px;
  transition: all 0.5s ease-in-out;
}

.folder:hover {
  background-color: #e2d6c9;
}

.crumbs {
  margin: 10px;
  margin-bottom: 20px;
}

.crumb {
  color: #c5741c;
  cursor: pointer;
  display: inline-block;
  transition: all 0.3s ease-in-out;
  border: 2px solid #e7ebda;
  padding: 5px 10px;
  border-radius: 12px;
}

.crumb:hover {
  background-color: #efe6dd;
}
</style>
