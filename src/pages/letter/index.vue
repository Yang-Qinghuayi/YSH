<template>
  <div>
    <v-text-field
      color="#4c0013"
      class="w-[50vw] mx-auto"
      v-model="headline"
    ></v-text-field>

    <v-textarea
      v-model="content"
      label="内容"
      outlined
      class="w-[50vw] mx-auto"
      rows="10"
      auto-grow
    ></v-textarea>

    <div class="w-[50vw] mx-auto">
      <v-btn
        class="w-full"
        variant="tonal"
        color="secondary"
        @click.prevent="generateImage"
      >
        生成图片
      </v-btn>
    </div>

    <v-card id="letter" class="mt-6 w-[50vw] mx-auto">
      <v-card-title class="text-center my-6 text-6xl">{{
        headline
      }}</v-card-title>
      <v-card-text class="mx-6 text-4xl">
        <p
          v-for="(paragraph, index) in paragraphs"
          :key="index"
          class="text-indent"
        >
          {{ paragraph }}
        </p>
      </v-card-text>
    </v-card>
  </div>
</template>

<script setup>
import { ref } from "vue";
import html2canvas from "html2canvas";

const headline = ref("");

const content = ref("");

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
    link.download = "article.png";
    link.click();
  }
};
</script>

<style scoped>
.text-indent {
  text-indent: 2em; /* 设置首行缩进 */
}
</style>
