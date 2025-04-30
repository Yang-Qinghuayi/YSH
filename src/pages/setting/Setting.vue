<template>
  <section class="d-flex justify-center">
    <div style="max-width: 960px" class="flex mt-6 flex-column gap-4 flex-fill">
      <div>
        <div class="font-bold">听我说</div>
        <div class="py-8 px-2">“口痰可以用作胶水。”</div>
      </div>

      <app-settings-theme />
      <!-- <app-settings-other /> -->
      <!-- <app-settings-reset /> -->
    </div>
  </section>
</template>

<script setup lang="ts">
import AppSettingsTheme from "./components/Theme.vue";
</script>
