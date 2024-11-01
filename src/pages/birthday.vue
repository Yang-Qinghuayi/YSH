<template>
  <div style="display: flex; height: 90vh; align-items: center; justify-content: center">
    <!-- 这是门 -->
    <transition name="fade">
      <div v-if="showDoor" class="door">
        <img class="doorImg mb-1" src="@/assets/birth/door.png" />
        <v-text-field
          class="mx-6 py-6"
          density="default"
          variant="outlined"
          v-model="inputPassword"
          label="输入密码"
        ></v-text-field>
        
        <div class="buttons">
          <transition name="fade">
            <v-btn color="primary" size="large" variant="tonal" class="mr-4 px-10 rounded-pill" @click="openDoor">
              {{ openThedoor }}
            </v-btn>
          </transition>

          <transition name="fade">
            <v-btn
              v-show="doorBtn"
              color="primary"
              size="large"
              variant="tonal"
              class="mr-4 px-10 rounded-pill"
              @click="forceOpen"
            >
              就不开!
            </v-btn>
          </transition>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="showGift">
        <img class="doorImg" src="@/assets/birth/gift.png" />
        <div class="buttons mt-8">
          <v-btn color="primary" size="large" variant="tonal" class="mr-4 px-10 rounded-pill" @click="openGift">
            拆开看看
          </v-btn>
          <v-btn color="primary" size="large" variant="tonal" class="mr-4 px-10 rounded-pill" @click="reOpenDoor">
            我想重新开门
          </v-btn>
        </div>
      </div>
    </transition>
    <transition name="fade">
      <div v-if="showCake" class="GPT">
        <!-- 蛋糕 -->
        <div class="cake">
          <img src="@/assets/birth/cake.jpg" />
        </div>
        <v-text-field
          class="mx-6 py-6"
          density="default"
          variant="outlined"
          v-model="input"
          @keyup.enter="chatGPT"
          label="许个愿望,回车发送"
        ></v-text-field>
        <v-card>
          <v-card-text>
            <!-- 展示问题 -->
            <v-card-title v-if="show">{{ input }}</v-card-title>
            {{ message }}
          </v-card-text>
        </v-card>
      </div>
    </transition>
  </div>
</template>

<script setup>


let inputPassword = ref('')


let openGift = () => {
  showGift.value = false
  setTimeout(() => {
    showCake.value = true
  }, 1000)
}

let input = ref('')
// 定义变量
let message = ref('比方说: 我想在有生之年登上月球 我想赚大钱 我想给长城贴上瓷砖')

let show = ref(false)

let done = ref(true)
import { set } from 'lodash-es'
import { OpenAI } from 'openai'
const baseURL = 'https://chatapi.onechats.top/v1'
const apiKey = 'sk-zgYxnRS8uGrUP33P7d6043C586174cD0819cE7139311Cf03'
const openai = new OpenAI({ baseURL, apiKey, dangerouslyAllowBrowser: true })

let question = ', 我的名字是李炜杰,今天是我的生日, 请编写一个小故事,再写一段生日祝福给我,字数要多,谢谢你'

const chatGPT = async () => {
  message.value = ''
  done.value = false
  show.value = true
  // 发送请求
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful assistant.',
      },
      {
        role: 'user',
        content: input.value + question,
      },
    ],
    stream: true,
  })
  done.value = true
  const reader = response.iterator()
  while (true) {
    const { done, value } = await reader.next()
    if (done) break
    const text = value.choices[0].delta.content || ''
    message.value += text
  }
}

let showDoor = ref(true)
let showGift = ref(false)
let showCake = ref(false)
let doorBtn = ref(true)
let openThedoor = ref('开门看看')

let forceOpen = () => {
  setTimeout(() => {
    doorBtn.value = false
    openThedoor.value = '来都来了, 必须开!'
  }, 1000)
}

let openDoor = () => {

  if (inputPassword.value !== '李炜杰帅得要命') {
    return
  }


  showDoor.value = false
  setTimeout(() => {
    showGift.value = true
  }, 1000)
}

let reOpenDoor = () => {
  showGift.value = false
  showDoor.value = true
}
</script>

<style scoped>
.GPT {
  width: 30vw;
  display: flex;
  flex-direction: column;
}

.cake {
  margin: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.door {
  margin: auto;
}

.doorImg {
  width: 100%;
  max-width: 200px;
  margin: auto;
  display: block;
}

.buttons {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
