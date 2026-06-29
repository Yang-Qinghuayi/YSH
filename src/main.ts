import { GesturePlugin } from "@vueuse/gesture";
import { createApp } from "vue";
// @ts-ignore
import VueVirtualScroller from "vue-virtual-scroller";

import App from "./App.vue";
// directives
import { useDirectives } from "./directives";
// plugins
import { useDayjs } from "./plugins/dayjs";
import { usePinia } from "./plugins/pinia";
import { t } from "./utils/i18n";
import { useToast } from "./plugins/toast";
import { useVuetify } from "./plugins/vuetify";
import { useRouter } from "./router";

// 加载css fonts等资源
import "./styles/tailwind.css"; // Tailwind v4
import "./styles/animate.scss";
import "./styles/global.scss";
import "./styles/utility.scss";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

const app = createApp(App);
useRouter(app);

// 注册全局 $t，供模板中 {{ $t('key') }} 使用（必须在 mount 前注册）
app.config.globalProperties.$t = t;
app.use(VueVirtualScroller);
app.use(GesturePlugin);
usePinia(app);
useVuetify(app);
useToast(app);
useDirectives(app);
useDayjs(app);
app.mount("#app").$nextTick();
