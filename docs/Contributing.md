# Como contribuir

## Pré-requisitos

- Node.js 20+
- pnpm (o repositório usa `pnpm-lock.yaml`)

## Setup

```bash
pnpm install        # instala deps e configura o Husky (script prepare)
pnpm dev
```

## Fluxo de trabalho

1. Crie uma branch a partir de `main`: `feat/<curto-descritivo>` ou `fix/...`.
2. Faça mudanças pequenas e coesas.
3. Rode localmente antes de commitar:
   ```bash
   pnpm typecheck && pnpm lint && pnpm format:check
   ```
4. Commit seguindo **Conventional Commits** (validado no `commit-msg`).
5. Abra um Pull Request. O PR deve passar em typecheck, lint e build.

## Conventional Commits

Formato: `tipo(escopo): descrição`

Tipos permitidos: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`,
`build`, `ci`, `chore`, `revert`.

```
feat(pousadas): adiciona filtro por experiência
fix(header): corrige estado aria do menu mobile
docs(readme): atualiza instruções de setup
chore(deps): atualiza next para 16.2.6
```

## Hooks de git (Husky)

- **pre-commit** → `lint-staged` roda ESLint (`--fix`) + Prettier nos arquivos alterados.
- **commit-msg** → `commitlint` valida a mensagem.

Se os hooks não dispararem, rode `pnpm prepare` uma vez.

## Checklist de PR

- [ ] `pnpm typecheck` sem erros
- [ ] `pnpm lint` sem erros
- [ ] `pnpm build` conclui
- [ ] UI nova usa o Design System (`components/ui`)
- [ ] Sem segredos/credenciais no código
- [ ] Textos de interface em pt-BR
