import path from 'path'
import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'

const externalPackages = [
  '@endge/nova',
  '@endge/nova-ui-kit',
  '@endge/utils',
]

function isExternal(id: string): boolean {
  return externalPackages.some(pkg => id === pkg || id.startsWith(`${pkg}/`))
}

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      name: 'endge-nova-modeler',
      fileName: 'nova-modeler',
    },
    rollupOptions: {
      external: isExternal,
    },
  },
  plugins: [dts({ rollupTypes: true, tsconfigPath: './tsconfig.app.json' })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.bench.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/model/**/*.ts'],
      exclude: ['src/model/types.ts', 'src/model/types/**/*.ts', 'src/model/module/**/*.ts'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
