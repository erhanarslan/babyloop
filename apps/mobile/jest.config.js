/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "^@babyloop/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^\\./analytics-events\\.js$": "<rootDir>/../../packages/shared/src/analytics-events.ts",
    "^\\./message-moderation\\.js$": "<rootDir>/../../packages/shared/src/message-moderation.ts",
    "^\\./realtime\\.js$": "<rootDir>/../../packages/shared/src/realtime.ts"
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  watchman: false
};
