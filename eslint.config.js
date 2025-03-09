// eslint.config.js
// @ts-nocheck
import globals from "globals";
import js from "@eslint/js"; // Base JavaScript rules
import pluginImport from "eslint-plugin-import"; // Import linting
import pluginPrettier from "eslint-plugin-prettier"; // Prettier integration
import prettierConfig from "eslint-config-prettier"; // Disables conflicting rules

export default [
    // Base configuration for all JavaScript files
    {
        files: ["**/*.js"], // Apply to all .js files
        languageOptions: {
            ecmaVersion: "latest", // ES2023 as of March 2025
            sourceType: "module", // ES modules
            globals: {
                ...globals.browser, // Browser globals (window, document, etc.)
                ...globals.webextensions, // Optional: for Web Worker support
            },
        },
        plugins: {
            import: pluginImport, // For import-related rules
            prettier: pluginPrettier, // Integrates Prettier
        },
        rules: {
            ...js.configs.recommended.rules, // ESLint's recommended JS rules
            ...prettierConfig.rules, // Disable ESLint rules that conflict with Prettier
            "prettier/prettier": "error", // Treat Prettier violations as ESLint errors

            // Code Quality
            "no-unused-vars": [
                "error",
                { vars: "all", args: "after-used", ignoreRestSiblings: true },
            ],
            "no-console": "warn", // Warn on console.log (adjust to "error" if stricter)
            eqeqeq: ["error", "always"], // Enforce === over ==
            curly: "error", // Require curly braces for all blocks

            // Import Rules
            "import/order": ["error", { groups: [["builtin", "external", "internal"]] }], // Sort imports
            "import/no-unresolved": "error", // Catch unresolved imports
            "import/no-duplicates": "error", // Prevent duplicate imports

            // Style Consistency (aligned with your .prettierrc)
            "max-len": ["warn", { code: 110 }], // Match printWidth from .prettierrc
            "comma-dangle": ["error", "only-multiline"], // Match trailingComma: "es5"
        },
    },

    // Specific configuration for Web Worker files
    {
        files: ["worker.js"], // Target worker.js specifically
        languageOptions: {
            globals: {
                ...globals.webextensions, // Worker-specific globals (self, postMessage)
            },
        },
        rules: {
            "no-restricted-globals": ["error", "window", "document"], // Prevent browser globals in workers
        },
    },

    // Ignore certain files or directories
    {
        ignores: ["dist/**", "node_modules/**", "*.min.js"], // Skip build, dependencies, minified files
    },
];
