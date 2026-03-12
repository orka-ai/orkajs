import type { Document, Chunk } from '@orkajs/core';
import type { TextSplitter, CodeTextSplitterOptions } from './types.js';
import { RecursiveCharacterTextSplitter } from './recursive-character-text-splitter.js';

const LANGUAGE_SEPARATORS: Record<string, string[]> = {
  typescript: [
    '\nexport class ',
    '\nexport function ',
    '\nexport interface ',
    '\nexport type ',
    '\nexport const ',
    '\nclass ',
    '\nfunction ',
    '\ninterface ',
    '\ntype ',
    '\nconst ',
    '\n\n',
    '\n',
    ' ',
    '',
  ],
  javascript: [
    '\nexport class ',
    '\nexport function ',
    '\nexport default ',
    '\nexport const ',
    '\nclass ',
    '\nfunction ',
    '\nconst ',
    '\nlet ',
    '\nvar ',
    '\n\n',
    '\n',
    ' ',
    '',
  ],
  python: [
    '\nclass ',
    '\ndef ',
    '\nasync def ',
    '\n\n',
    '\n',
    ' ',
    '',
  ],
  java: [
    '\npublic class ',
    '\nprivate class ',
    '\nprotected class ',
    '\npublic static ',
    '\npublic ',
    '\nprivate ',
    '\nprotected ',
    '\n\n',
    '\n',
    ' ',
    '',
  ],
  go: [
    '\nfunc ',
    '\ntype ',
    '\nvar ',
    '\nconst ',
    '\n\n',
    '\n',
    ' ',
    '',
  ],
  rust: [
    '\npub fn ',
    '\nfn ',
    '\npub struct ',
    '\nstruct ',
    '\nimpl ',
    '\npub enum ',
    '\nenum ',
    '\n\n',
    '\n',
    ' ',
    '',
  ],
  cpp: [
    '\nclass ',
    '\nvoid ',
    '\nint ',
    '\nfloat ',
    '\ndouble ',
    '\nnamespace ',
    '\n#include',
    '\n\n',
    '\n',
    ' ',
    '',
  ],
  html: [
    '\n<div',
    '\n<section',
    '\n<article',
    '\n<header',
    '\n<footer',
    '\n<main',
    '\n<nav',
    '\n<table',
    '\n<ul',
    '\n<ol',
    '\n\n',
    '\n',
    ' ',
    '',
  ],
  css: [
    '\n@media',
    '\n@keyframes',
    '\n.',
    '\n#',
    '\n\n',
    '\n',
    ' ',
    '',
  ],
};

export class CodeTextSplitter implements TextSplitter {
  private splitter: RecursiveCharacterTextSplitter;

  constructor(options: CodeTextSplitterOptions) {
    const separators = LANGUAGE_SEPARATORS[options.language];
    if (!separators) {
      throw new Error(`Unsupported language: ${options.language}. Supported: ${Object.keys(LANGUAGE_SEPARATORS).join(', ')}`);
    }

    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize ?? 1000,
      chunkOverlap: options.chunkOverlap ?? 200,
      separators,
      keepSeparator: true,
      trimWhitespace: options.trimWhitespace ?? true,
    });
  }

  split(text: string): string[] {
    return this.splitter.split(text);
  }

  splitDocuments(documents: Document[]): Chunk[] {
    return this.splitter.splitDocuments(documents);
  }
}
