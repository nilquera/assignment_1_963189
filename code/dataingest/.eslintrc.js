const RULES = {
  OFF: "off",
  WARN: "warn",
  ERROR: "error",
};

module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: ["standard", "prettier"],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "no-unused-vars": RULES.WARN,
    "no-unneeded-ternary": RULES.OFF,
  },
};
