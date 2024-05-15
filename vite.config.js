// This config file builds the module that is published to npm.
import path from 'path';
import { defineConfig } from 'vite';
import banner from 'vite-plugin-banner'
import pkg from './package.json'
import dts from "vite-plugin-dts";

// Now in UTC time. Format time as YYYY-MM-DDTHH:mm:ss.sssZ.
const now = new Date().toISOString()

export default defineConfig({
    build: {
        lib: {
            entry: [
                path.resolve(
                    __dirname,
                    'lib/proofread-transcript.ts'
                ),
            ],
            name: 'proofread-transcript',
            format: ['es', 'umd'],
            fileName: (format,filename) =>
                `${filename}.${format}.js`,
        },  
        minify: false,
    },
    plugins: [
        banner(
            `/**\n * name: ${pkg.name}\n * version: v${pkg.version}\n * description: ${pkg.description}\n * author: ${pkg.author}\n * repository: ${pkg.repository.url}\n * build date: ${now} \n */`
        ),
        dts({
            insertTypesEntry: true,
        }),
    ],
})
