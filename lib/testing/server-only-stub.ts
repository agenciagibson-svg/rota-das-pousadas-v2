// Stub para o alias de `server-only` no Vitest (ver vitest.config.ts).
//
// `server-only` não é um pacote npm de verdade — é um alias interno do
// bundler do Next.js (webpack/turbopack), que aponta pra um módulo vazio em
// builds de servidor e pra um módulo que lança erro em builds de cliente.
// Fora do Next (aqui, rodando testes com Vite puro), essa especificação nunca
// resolve sozinha. Este stub reproduz só o comportamento de build de
// servidor (não faz nada) — não enfraquece a proteção real: em produção,
// quem decide se um arquivo com `import 'server-only'` pode ir pro bundle do
// cliente continua sendo o Next.js, não o Vitest.
export {}
