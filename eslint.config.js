import js from '@eslint/js';
import importX from 'eslint-plugin-import-x';
import prettier from 'eslint-plugin-prettier/recommended';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'public/**',
      'node_modules/**',
      // vendored 的 foliate-js（上游代码，不参与本项目风格约束）
      'src/foliate-js/**',
      'src/auto-imports.d.ts',
      'src/components.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // .vue 文件用 vue-eslint-parser + TS parser 处理 <script lang="ts">
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'vue/no-unused-vars': 'warn',
    },
  },

  // import 规则（替代已进入维护模式的 eslint-plugin-import）
  importX.flatConfigs.recommended,
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    settings: {
      'import-x/resolver': { node: { extensions: ['.js', '.ts', '.vue'] } },
    },
    rules: {
      'simple-import-sort/imports': 'warn',
      'simple-import-sort/exports': 'warn',
      // 模块解析交给 tsc / vue-tsc：这里只忽略路径别名，避免与打包器配置重复
      'import-x/no-unresolved': 'off',
      // 解析相关的规则（重复导入、默认导出形状）交给 tsc/vue-tsc：
      // 它们需要额外的 resolver 包才能理解 `@/` 别名与 .vue 后缀
      'import-x/no-duplicates': 'off',
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-absolute-path': 'off',
      'import-x/named': 'off',
      'import-x/default': 'off',
      'import-x/namespace': 'off',
      'import-x/order': 'off',

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      '@typescript-eslint/consistent-indexed-object-style': ['error', 'record'],

      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
    },
  },

  // `_foo` 表示「有意不使用」的参数/变量（例如为保持签名一致的占位参数）。
  // 只覆盖非 .vue 文件：.vue 里由上面的块统一关闭（模板/宏的变量统计交给 vue-tsc）
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // Prettier 只负责格式：关掉与之冲突的规则，并把格式差异报成 lint 错误
  prettier,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // 测试与脚本跑在 Node 上
  {
    files: ['tests/**/*.{ts,mjs,js}', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
