import { GesturePlugin } from "@vueuse/gesture";
import { createApp } from "vue";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import VueVirtualScroller from "vue-virtual-scroller";

import App from "./App.vue";
// directives
import { useDirectives } from "./directives";
// plugins
import { useContextMenu } from "./plugins/contextmenu";
import { useDayjs } from "./plugins/dayjs";
import { useI18n } from "./plugins/i18n";
import { usePinia } from "./plugins/pinia";
import { useToast } from "./plugins/toast";
import { useVuetify } from "./plugins/vuetify";
import { useRouter } from "./router";
import { useFonts } from "./plugins/webfontloader";

// 加载css fonts等资源
// useFonts()
import "./styles/animate.scss";
import "./styles/global.scss";
import "./styles/utility.scss";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";


const app = createApp(App);
const router = useRouter(app);

app.use(VueVirtualScroller);
app.use(GesturePlugin);
usePinia(app);
useVuetify(app);
useI18n(app);
useToast(app);
useDirectives(app);
useDayjs(app);
useContextMenu(app);
app.mount("#app").$nextTick();
