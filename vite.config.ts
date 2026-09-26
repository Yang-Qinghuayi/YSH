/* eslint-disable import/no-unresolved */
import tailwindcss from '@tailwindcss/postcss';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import autoprefixer from 'autoprefixer';
import path from 'path';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { defineConfig } from 'vite';
import vuetify from 'vite-plugin-vuetify';

import { dependencies, devDependencies, name, version } from './package.json';

const __APP_INFO__ = {
  pkg: { dependencies, devDependencies, name, version },
  lastBuildTime: new Date().toISOString(),
};

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isDevelopment = command === 'serve';
  return {
    envDir: path.resolve(__dirname, './'),
    root: __dirname,
    plugins: [
      vue(),
      vuetify({
        styles: {
          configFile: './src/styles/settings.scss',
        },
      }),
      vueJsx(),
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
      postcss: {
        plugins: [tailwindcss, autoprefixer],
      },
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
