# Trabalho no aplicativo

Esta pasta é a raiz do aplicativo e do repositório Git. Execute os comandos aqui;
a pasta externa contém o ZIP importado e não é um checkout funcional.

Leia `AI_RULES.md` antes de editar. Para localizar código, use `rg` excluindo
`node_modules`, `.next` e arquivos de lock; consulte os scripts em `package.json`.
No PowerShell com scripts bloqueados, use `pnpm.cmd` em vez de `pnpm`.

## Contexto por tarefa

- Arquitetura e fronteiras: `docs/Architecture.md` e `docs/CodingStandards.md`.
- Interface: `docs/DesignSystem.md` e `docs/DesignFoundations.md`.
- Reservas, gestão, financeiro, autenticação e acomodações: documento correspondente
  em `docs/features/`, depois a feature e seus repositories.
- Banco e permissões: `supabase/README.md`, migrations da área e `lib/auth/`.
- Concierge: `features/concierge/` e `components/concierge/travel-concierge.tsx`.
  A recomendação atual é determinística; os agentes LLM da arquitetura são planos.
- Diagnóstico atualizado: `docs/ANALISE-2026-09-11.md`. `AUDITORIA.md` retrata
  o protótipo original; confirme suas afirmações no código atual.

## Verificação

Reproduza bugs com testes focados antes de corrigir. Testes de lógica usam Node;
testes que precisam de DOM declaram `// @vitest-environment jsdom` no início.
Execute as verificações exigidas em `AI_RULES.md`, além dos testes afetados.
Formate os arquivos alterados; reporte separadamente falhas preexistentes.
Ao entregar, diferencie verificações locais, integrações não exercitadas e medições
de produção. Use dados sintéticos nos testes; preserve credenciais e dados reais.
