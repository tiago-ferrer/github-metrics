import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";

const isWatch = !!process.env.ROLLUP_WATCH;
const sdPlugin = "dev.tferrer.githubmetrics.sdPlugin";

export default {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    format: "cjs",
    sourcemap: isWatch,
    sourcemapPathTransform: (relativeSourcePath) => `../../${relativeSourcePath}`,
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      compilerOptions: { outDir: undefined, declaration: false, declarationDir: undefined },
      sourceMap: isWatch,
    }),
  ],
};
