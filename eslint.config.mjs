import js from '@eslint/js';
import {defineConfig,globalIgnores} from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default defineConfig([
 globalIgnores(['dist/**','node_modules/**','.sites-runtime/**','android/**','outputs/**','work/**']),
 js.configs.recommended,
 ...tseslint.configs.recommended,
 {
  files:['**/*.{js,mjs,cjs,ts,tsx,mts}'],
  languageOptions:{globals:globals.browser},
 },
 {
  files:['scripts/**/*.{js,mjs,cjs}','tests/**/*.{js,mjs,cjs}','*.config.{js,mjs,cjs,ts}','eslint.config.mjs'],
  languageOptions:{globals:{...globals.node,...globals.browser}},
 },
 {
  files:['public/sw.js'],
  languageOptions:{globals:{...globals.browser,...globals.serviceworker}},
 },
 {
  files:['**/*.{ts,tsx}'],
  plugins:{'react-hooks':reactHooks},
  rules:{
   'react-hooks/rules-of-hooks':'error',
   'react-hooks/exhaustive-deps':'warn',
  },
 },
 {
  files:['components/ui/**/*.{ts,tsx}','hooks/use-mobile.ts'],
  rules:{
   '@typescript-eslint/no-unused-vars':'off',
   'react-hooks/purity':'off',
   'react-hooks/set-state-in-effect':'off',
  },
 },
]);
