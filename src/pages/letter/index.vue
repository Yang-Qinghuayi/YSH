<template>
  <v-textarea rows="10" auto-grow></v-textarea>
</template>

<script>
import { createApp } from "vue";
import { createVuetify } from "vuetify";
import { VApp, VContainer, VTextarea } from "vuetify/components";

const vuetify = createVuetify();

export default {
  name: "App",
  components: {
    VApp,
    VContainer,
    VTextarea,
  },
  setup() {
    return { vuetify };
  },
};
</script>

<style></style>
