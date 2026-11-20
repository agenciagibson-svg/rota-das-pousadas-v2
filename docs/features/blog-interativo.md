# Blog interativo (mapa, feriadão e dicas dos leitores)

Três blocos no fim de cada guia (`app/blog/[slug]/page.tsx`):

1. **No mapa** — `features/blog/components/guide-map.tsx`. Pontos do texto
   (`post.places`, de `features/blog/places.ts`, coordenadas do OpenStreetMap)
   e as pousadas da Rota na cidade que têm ponto marcado (0095). Clicar num
   ponto abre "Como chegar" (rota no Google Maps); numa pousada, o cartão da
   busca. Reaproveita `components/map` (MapLibre + OpenFreeMap).
2. **Onde ficar + próximo feriadão** — `features/blog/services/holiday-stays.service.ts`
   pega o próximo feriadão (pulando o que começa em menos de 2 dias) e roda a
   busca pública com as datas e 2 hóspedes (`search_public_pousadas`, que
   confere a disponibilidade real). Sem pousada livre, mostra o atalho para a
   busca já com as datas. Falha na busca não derruba o guia.
3. **Dicas de quem já foi** — migration `0108_dicas_dos_leitores.sql`.
   - Visitante manda nome, cidade (opcional), dica (20–600) e foto (opcional),
     com consentimento e Turnstile. A foto é reduzida no navegador para JPEG
     (até 1600 px, o que também apaga a localização da câmera).
   - `submit_blog_tip` valida, limita a 20 dicas por guia por hora e 300 na
     fila, e reserva o caminho da foto; o upload só vale nesse caminho, por
     15 minutos, uma vez.
   - Nada aparece antes de aprovado em **/admin → Blog** (suporte, marketing e
     master — `content:moderate`). Recusar apaga a foto. Cada decisão vai para
     a auditoria.
   - Fotos ficam no bucket privado `blog-tips` e aparecem por URL assinada.
   - Sem Supabase (versão de teste com dados de exemplo), o guia mostra duas
     dicas de exemplo e o envio só simula.

Novo guia: inclua `places` com os pontos do texto (veja `places.ts`).
