import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';
import vuetify from 'vite-plugin-vuetify';

import packageJson from './package.json' with { type: 'json' };

const { dependencies, devDependencies, name, version } = packageJson;

const __APP_INFO__ = {
  pkg: { dependencies, devDependencies, name, version },
  lastBuildTime: new Date().toISOString(),
};

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isDevelopment = command === 'serve';
  return {
    envDir: path.resolve(import.meta.dirname, './'),
    root: import.meta.dirname,
    plugins: [
      // Tailwind v4 走 Vite 插件，不再需要 postcss / autoprefixer / @tailwindcss/postcss
      tailwindcss(),
      vue(),
      vuetify({
        // 按需注册：只把模板里用到的 <v-*> 组件及其样式打进产物，
        // 而不是 `import * as components` 全量 100+ 组件（首屏 -50%）。
        autoImport: true,
        styles: {
          configFile: './src/styles/settings.scss',
        },
      }),
      // https://github.com/antfu/unplugin-auto-import
      AutoImport({
        imports: ['vue', 'vue-router', '@vueuse/core'],
        dts: './src/auto-imports.d.ts',
        dirs: ['./src/hooks'],
      }),
      Components({
        dts: './src/components.d.ts',
      }),
    ],
    base: './',

    server: {
      host: '0.0.0.0',
      // 允许通过代理域名访问开发服务器（Arena 预览环境）
      allowedHosts: true,
    },

    // 预览生产构建（pnpm start）：同样监听 0.0.0.0 并放开代理域名，
    // 便于在 Vercel 部署前用 dist/ 产物做本地验证
    preview: {
      host: '0.0.0.0',
      allowedHosts: true,
    },

    build: {
      emptyOutDir: true,
      sourcemap: isDevelopment,
      target: 'es2022',
    },
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },

    css: {
      preprocessorOptions: {
        sass: {
          api: 'modern',
          silenceDeprecations: ['legacy-js-api'],
        },
        scss: {
          api: 'modern',
          silenceDeprecations: ['legacy-js-api'],
        },
      },
    },

    define: {
      __APP_INFO__: JSON.stringify(__APP_INFO__),
    },
  };
});
