/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "^@babyloop/shared$": "<rootDir>/../../packages/shared/src/analytics-events.ts"
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  watchman: false
};
