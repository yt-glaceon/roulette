export default {
  testEnvironment: 'jsdom',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  // 他トピックのワークツリー(.claude/worktrees/)のテストを拾わないため
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/.claude/'
  ],
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/config.js',
    '!js/app-controller.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
