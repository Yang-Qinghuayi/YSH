<template>
  <div>
    <!-- 还没登录的时候显示的界面 -->
    <div v-show="!loggedIn" class="mt-[30vh]">
      <div class="mt-6 flex items-center bg-gray-100 rounded-full px-4 py-2 w-full">
        <input
          type="text"
          v-model="key"
          placeholder="gpt密钥"
          class="flex-grow bg-transparent outline-none py-2 px-2"
        />
      </div>
      <div class="d-flex justify-center mx-3 align-center">
        <v-btn color="primary" size="large" variant="tonal" class="mr-4 px-10 rounded-pill mt-10" @click="setSK">
          启用
        </v-btn>
      </div>
    </div>
    <div v-show="loggedIn" @contextmenu="addBooks">
      <!-- 这是三个复选框 -->
      <div class="fixed left-100 top-5">
        <v-btn-toggle shaped mandatory v-model="gptModelIndex" variant="tonal" color="primary" rounded="xl">
          <v-btn>gpt-3.5</v-btn>
          <v-btn> gpt-4o</v-btn>
          <v-btn>gpt-4</v-btn>
        </v-btn-toggle>
      </div>
      <!-- 这是图标 -->
      <div v-if="!list.length" class="w-[40vw] h-[84vh] mx-auto flex">
        <GptIcon class="w-[3rem] h-[3rem] my-auto mx-auto" />
      </div>

      <!-- 展示内容 -->
      <div
        v-else
        id="scrollGPT"
        ref="scrollGPT"
        :style="{ height: componentHeight + 'px' }"
        class="w-[clamp(60px,90%,820px)] overflow-auto mx-auto mt-4"
      >
        <v-card-text v-for="item in list">
          <div class="flex justify-end text-xm mb-2">
            <v-card color="secondary" variant="tonal" class="rounded-lg p-3 px-5">
              {{ item.question }}
            </v-card>
          </div>
          <!-- gpt回答部分 -->

          <div class="relative w-full overflow-auto">
            <v-card color="secondary" variant="tonal" class="rounded-lg ">
              <MdPreview class="pt-3" previewTheme="vuepress" :modelValue="item.content" />
              <!-- 封面中的按钮 -->
              <div class="absolute top-1 right-1">
                <div>
                  <v-btn size="small" icon color="primary" variant="tonal" @click="copyContent(item.content)">
                    <v-icon color="secondary" size="small" :icon="mdiContentCopy"></v-icon>
                  </v-btn>
                </div>
              </div>
            </v-card>
          </div>
        </v-card-text>
      </div>
      <!-- 输入框,回车发送 -->
      <div class="flex justify-center">
        <div class="flex fixed bottom-5 w-[clamp(100px,90%,780px)] bg-gray-100 rounded-3xl px-4 py-2">
          <!-- 输入部分 -->
          <textarea
            ref="inputRef"
            v-model="input"
            placeholder="给“ChatGPT”发送消息"
            @keydown="handleKeyDown"
            rows="1"
            @input="adjustTextareaHeight"
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
            class="max-h-52 flex-grow bg-transparent outline-none py-2 px-2 resize-none overflow-hidden"
          ></textarea>
          <!-- 按钮发送部分 -->
          <v-btn :loading="!sended" size="small" icon color="primary" variant="tonal" @click="chatGPT">
            <v-icon color="secondary" :disabled="!input.trim()" size="large" :icon="mdiSend"></v-icon>
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// 复制功能
import { useClipboard } from '@vueuse/core'
const { copy } = useClipboard()
// 这是复制
function copyContent(text) {
  try {
    copy(text)
    toast.success('已复制到剪切板')
  } catch (e) {
    console.log(e)
  }
}

import { mdiContentCopy } from '@mdi/js'

// 高度自适应
const componentHeight = ref(0)
const updateHeight = () => {
  componentHeight.value = window.innerHeight - 116
}
// 初始设置高度
onMounted(() => {
  updateHeight()
})
// 组件销毁时移除事件监听
onUnmounted(() => {
  window.removeEventListener('resize', updateHeight)
})

// 调整输入框高度
const adjustTextareaHeight = () => {
  const textarea = inputRef.value
  textarea.style.height = 'auto' // 重置高度
  textarea.style.height = textarea.scrollHeight + 'px' // 根据内容设置高度
  // 确保textarea向上扩展，而不是向下扩展
  textarea.scrollTop = textarea.scrollHeight
}

// 在组件挂载后，添加全局事件监听器
onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeyDown)
  adjustTextareaHeight() // 调整初始高度
})

// 在组件卸载前，移除全局事件监听器
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeyDown)
})
import { useToast } from 'vue-toastification'
const toast = useToast()

const handleGlobalKeyDown = (event) => {
  // Shift + Esc 聚焦输入框
  if (event.key === 'Escape' && event.shiftKey) {
    event.preventDefault() // 试图阻止默认行为
    inputRef.value.focus()
  }
  // 开启新的对话

  if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === 'o' || event.key === 'O')) {
    event.preventDefault()
    list.value = []
  }
  // 复制最后一条消息
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && (event.key === 'c' || event.key === 'C')) {
    event.preventDefault()
    copyContent(list.value[list.value.length - 1]?.content)
  }
}

// 发送
const inputRef = ref(null)

const handleKeyDown = async (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    if (!isComposing.value) {
      await chatGPT()
    }
  }
}

const isComposing = ref(false)

import { useGPTStore } from '@/store/gptSt'
let gptStore = useGPTStore()

const key = ref('')
const loggedIn = ref(false)

key.value = gptStore.key
loggedIn.value = gptStore.loggedIn

function setSK() {
  gptStore.Set_Key(key.value)
  gptStore.Set_LoggedIn(true)
  loggedIn.value = true
}

const sended = ref(true)

const list = ref([])
// 选择gpt模型
const gptModelIndex = ref('0')
const gptModelList = ['gpt-3.5-turbo', 'gpt-4o', 'gpt-4']
const gptModel = computed(() => gptModelList[gptModelIndex.value])

loggedIn.value = gptStore.loggedIn

list.value = gptStore?.list
gptModelIndex.value = gptStore.modelIndex ?? 0
watchEffect(() => {
  gptStore.Set_List(list.value)
})

watchEffect(() => {
  gptStore.Set_ModelIndex(gptModelIndex.value)
})

// 清除内容
import { useContextMenu } from 'vuetify-ctx-menu/lib/main'
const contextMenu = useContextMenu()
const { themeName } = useCurrentTheme()
function addBooks(event) {
  // 劫持系统默认行为
  event.preventDefault()
  const { x, y } = event
  const option = {
    theme: themeName.value,
    x,
    y,
    items: [
      {
        label: '清除聊天内容',
        onClick: () => {
          list.value = []
        },
      },
    ],
    offsetFooter: 64,
    customClass: 'bg-surfaceVariant',
  }
  contextMenu(option)
}

// 发送消息按钮
import { mdiSend } from '@mdi/js'

const main = document.getElementById('scrollGPT')

let scrollGPT = ref(null)

// 自动滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  const top = scrollGPT.scrollHeight
  if (main) {
    scrollGPT.scrollTop = top
  }
}

onMounted(async () => {
  await scrollToBottom()
})

onActivated(async () => {
  await scrollToBottom()
})

import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import GptIcon from './components/GptIcon.vue'

const baseURL = 'https://ssapi.onechat.shop/v1/chat/completions'

const currentDialogId = ref(null)
const messages = computed(() => {
  return [
    {
      role: 'user',
      content: input.value,
    },
    {
      role: 'user',
      content: '一步一步地分析，用中文md语法回答',
    },
  ]
})

const input = ref('')
// 获取聊天机器人的回复
async function chatGPT() {
  if (isComposing.value) return
  if (!input.value.trim()) return

  // 页面滑动到底部
  await scrollToBottom()
  sended.value = false
  for await (const result of getChatgpt_Multurn_qa(messages.value)) {
    // 如果返回的结果 ID 与当前对话 ID 相同，则将聊天机器人的回复拼接到当前对话中
    if (result.id === currentDialogId.value) {
      const index = list.value.findIndex((item) => item.id === currentDialogId.value)
      const dialog = list.value[index]
      dialog.content += result.content
    } else {
      currentDialogId.value = result.id
      list.value.push({
        content: result.content,
        role: 'assistant',
        id: result.id,
        timestamp: Date.now(),
        question: input.value,
      })
      sended.value = true
      input.value = ''
      inputRef.value.style.height = 'auto' // 重置高度
    }
  }
  await scrollToBottom()
}

async function* getChatgpt_Multurn_qa(messages) {
  const response = await fetch(baseURL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key.value}`,
    },
    body: JSON.stringify({
      model: gptModel.value,
      stream: true,
      messages: messages,
    }),
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const reader = response.body.getReader()
  let decoder = new TextDecoder()
  let resultData = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    resultData += decoder.decode(value)
    while (resultData.includes('\n')) {
      const messageIndex = resultData.indexOf('\n')
      const message = resultData.slice(0, messageIndex)
      resultData = resultData.slice(messageIndex + 1)
      if (message.startsWith('data: ')) {
        const jsonMessage = JSON.parse(message.substring(5))
        if (resultData.includes('[DONE]')) {
          break
        }
        const createdID = jsonMessage.created
        yield {
          content: jsonMessage.choices[0]?.delta?.content || '',
          role: 'assistant',
          id: createdID,
        }
      }
    }
  }
}
</script>
