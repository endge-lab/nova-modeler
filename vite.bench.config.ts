import baseConfig from './vite.config'

export default {
  ...baseConfig,
  test: {
    ...(baseConfig.test ?? {}),
    include: ['src/**/*.bench.ts'],
    exclude: [],
    testTimeout: 60_000,
    coverage: {
      enabled: false,
    },
  },
}
