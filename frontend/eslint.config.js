import globals from 'globals'
import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import * as tseslint from './typescript-eslint/index.js'

const resolveConfigs = (pkg) => pkg?.configs ?? pkg?.default?.configs ?? pkg?.module?.exports?.configs

const extendList = []
const jsConfigs = resolveConfigs(js)
if (jsConfigs?.recommended) {
  extendList.push(jsConfigs.recommended)
}
const hooksConfigs = resolveConfigs(reactHooks)
if (hooksConfigs?.flat?.recommended) {
  extendList.push(hooksConfigs.flat.recommended)
}
const refreshConfigs = resolveConfigs(reactRefresh)
if (refreshConfigs?.vite) {
  extendList.push(refreshConfigs.vite)
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: extendList,
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        sourceType: 'module',
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
    },
  },
])
