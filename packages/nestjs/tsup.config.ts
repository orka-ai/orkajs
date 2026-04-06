import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cqrs: 'src/cqrs.ts',
    microservice: 'src/microservice.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  treeshake: true,
  clean: true,
  sourcemap: true,
  external: [
    '@orka-js/core',
    '@orka-js/agent',
    '@nestjs/common',
    '@nestjs/core',
    '@nestjs/cqrs',
    '@nestjs/microservices',
    'reflect-metadata',
    'rxjs',
  ],
});
