export default [
  {
    files: ["services/**/*.js", "frontend/**/*.js", "tools/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: Object.fromEntries(
        [
          "process",
          "Buffer",
          "URL",
          "AbortSignal",
          "fetch",
          "structuredClone",
          "console",
        ].map((name) => [name, "readonly"]),
      ),
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-unreachable": "error",
      "no-dupe-args": "error",
      "no-dupe-keys": "error",
      "no-dupe-class-members": "error",
      "no-constant-condition": "error",
      "no-async-promise-executor": "error",
      "no-promise-executor-return": "error",
      "no-prototype-builtins": "error",
      "no-loss-of-precision": "error",
      "valid-typeof": "error",
      eqeqeq: "error",
    },
  },
];
