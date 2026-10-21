import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
    globalIgnores([
        'dist/',
        'coverage/',
        '.claude/',
        '.kiro/',
        '.vscode/',
        'server/node_modules/',
    ]),
    {
        files: ['js/**/*.js'],
        extends: [js.configs.recommended],
        languageOptions: { globals: { ...globals.browser } },
    },
    {
        files: ['tests/**/*.js'],
        extends: [js.configs.recommended],
        languageOptions: {
            globals: { ...globals.browser, ...globals.node, ...globals.jest },
        },
    },
    {
        files: ['server/**/*.js', '*.config.js'],
        extends: [js.configs.recommended],
        languageOptions: { globals: { ...globals.node } },
    },
]);
