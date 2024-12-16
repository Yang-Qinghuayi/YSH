<template>
  <div class="flex items-center justify-center flex-col">
    <textarea
      v-model="headline"
      class="p-3 w-[50vw] mx-auto theme-border m-6 custom-textarea"
      rows="1"
    ></textarea>
    <textarea
      v-model="content"
      class="w-[50vw] p-3 mx-auto theme-border mb-6 custom-textarea"
      rows="10"
    ></textarea>

    <textarea
      v-model="name"
      class="p-3 w-[50vw] mx-auto theme-border mb-6 custom-textarea"
      rows="1"
    ></textarea>
    <v-btn
      class="w-[50vw]"
      variant="tonal"
      color="secondary"
      @click.prevent="generateImage"
    >
      生成图片
    </v-btn>

    <v-card id="letter" class="mt-6 w-[600px] pic">
      <v-card-title class="text-center mt-13 mb-6 text-3xl">{{
        headline
      }}</v-card-title>
      <v-card-text class="mx-2 text-2xl mb-12">
        <p
          v-for="(paragraph, index) in paragraphs"
          :key="index"
          class="text-indent"
        >
          {{ paragraph }}
        </p>

        <p class="text-right pr-5">{{ name }}</p>

      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref } from "vue";
import html2canvas from "html2canvas";

const headline = ref("");

const content = ref("");

const name = ref("");

const paragraphs = computed(() => {
  return content.value
    .trim()
    .split("\n")
    .filter((paragraph) => paragraph.trim() !== "");
});

const generateImage = async () => {
  const element = document.getElementById("letter");
  if (element) {
    const canvas = await html2canvas(element);
    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${headline.value ?? "文字"}.png`;
    link.click();
  }
};
</script>

<style scoped>
.text-indent {
  /* 设置其底部空行 */
  margin-bottom: 1em;
}
.custom-textarea:focus {
  outline: none; /* 移除默认的聚焦样式 */
}
.custom-textarea {
  resize: none; /* 禁止用户调整文本框大小 */
}

.pic {
  /* 设置渐变色; */
  background: linear-gradient(to right, #f0e7e8, #f3ede6, #f5f1e7);
  color: #38161e;
}
</style>
