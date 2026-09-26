// 加载css fonts等资源
import './styles/tailwind.css'; // Tailwind v4
import './styles/animate.scss';
import './styles/global.scss';
import './styles/utility.scss';

import { createApp } from 'vue';

import App from './App.vue';
// plugins
import { usePinia } from './plugins/pinia';
import { useToast } from './plugins/toast';
import { useVuetify } from './plugins/vuetify';
import { useRouter } from './router';

const app = createApp(App);
useRouter(app);

usePinia(app);
useVuetify(app);
useToast(app);
app.mount('#app').$nextTick();
