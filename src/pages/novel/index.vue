<template>
  <!--
    小说页入口：只负责工作区初始化和三大布局块的组装。
    业务编排见 composables/useNovelPageController.ts，领域模块见 README.md。
  -->
  <div class="novel-root">
    <WorkspaceInit v-if="!workspaceReady" @done="handleWorkspaceReady" />

    <div v-else class="novel-page d-flex">
      <NovelEditorStage @stop="page.handleStopAgent" />
      <NovelSidebar @stop="page.handleStopAgent" />
      <NovelDialogs />

      <v-snackbar v-model="showError" :color="snackColor" timeout="6000" location="top">
        {{ errorMessage }}
      </v-snackbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import WorkspaceInit from '@/components/WorkspaceInit.vue';

import NovelDialogs from './components/NovelDialogs.vue';
import NovelEditorStage from './components/NovelEditorStage.vue';
import NovelSidebar from './components/NovelSidebar.vue';
import { useNovelPageController } from './composables/useNovelPageController';

const page = useNovelPageController();
const { workspaceReady, handleWorkspaceReady } = page.workspace;
const { showError, snackColor, errorMessage } = page.ui;
</script>

<style src="./novel-page.css"></style>
