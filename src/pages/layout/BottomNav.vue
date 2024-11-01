<script lang="ts" setup>
import { mdiAlbum, mdiBookshelf, mdiCloud, mdiMenu, mdiCog } from "@mdi/js";
import { useDisplay, useTheme } from "vuetify";
const display = useDisplay();
import { storeToRefs } from "pinia";
import { useSettingStore } from "@/store/setting";

const { catalog } = storeToRefs(useSettingStore()) as any;

const { showBook } = storeToRefs(useSettingStore()) as any;
const route = useRoute();
const router = useRouter();
const gotoOrChange = (destination: string) => {
  if (destination === route.name) {
    catalog.value = !catalog.value;
  } else {
    router.push({ name: destination });
  }
};
</script>
<template>
  <v-bottom-navigation
    color="surfaceVariant"
    class="app-bottom-nav"
    height="64"
    temporary
  >
    <v-btn value="discover" color="secondaryContainer" to="/bookShelves">
      <div class="bar-icon rounded-xl">
        <v-icon>{{ mdiBookshelf }}</v-icon>
      </div>
      <span class="bar-label">书架</span>
    </v-btn>

    <v-btn
      value="catalogue"
      color="secondaryContainer"
      @click="gotoOrChange('book')"
    >
      <div class="bar-icon rounded-xl">
        <v-icon>{{ mdiMenu }}</v-icon>
      </div>
      <span class="bar-label">书籍</span>
    </v-btn>

    <v-btn value="setting" color="secondaryContainer" to="/setting">
      <div class="bar-icon rounded-xl">
        <v-icon>{{ mdiCog }}</v-icon>
      </div>
      <span class="bar-label">设置</span>
    </v-btn>
  </v-bottom-navigation>
</template>

<style scoped lang="scss">
.app-bottom-nav {
  :deep(.v-bottom-navigation__content) {
    justify-content: space-evenly;
    .v-btn {
      .v-btn__content {
        gap: 4px;
        .bar-icon {
          width: 64px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.3s ease;
          i {
            transition: all 0.3s ease;
          }
        }
        .bar-label {
          color: rgb(var(--v-theme-onSurfaceVariant));
        }
      }
      &.v-btn--selected {
        .bar-icon {
          background-color: rgb(var(--v-theme-secondaryContainer));
          i {
            color: rgb(var(--v-theme-onSurface));
          }
        }
        .bar-label {
          color: rgb(var(--v-theme-onSurface));
        }
      }
    }
  }
}
/* scoped css */
</style>
