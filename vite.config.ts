import { resolve, join as joinPath } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		target: 'esnext',
		minify: false,
		emptyOutDir: true,
		lib: {
			entry: resolve(__dirname, 'src/index.ts'),
			name: 'docblock-parser',
			fileName: '[name]',
			formats: ['es'],
		},
		rollupOptions: {
			output: {
				preserveModules: true,
				dir: resolve(__dirname, 'dist'),
			},
		},
	},
});