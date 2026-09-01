# MASTER SCENE 01 — "The Invitation"

> **Identity Reference oficial** de toda a produção audiovisual da Rota das
> Pousadas. Nenhuma cena futura pode ser gerada sem usar esta especificação (e o
> render master associado) como referência de arquitetura, iluminação, paisagem,
> vegetação, fotografia e identidade visual.

| Campo | Valor |
|---|---|
| Status | Render master em produção (Higgsfield) |
| Job (imagem master 2K) | `7e8065a0-21cd-4468-b8b5-f0340840d1b5` · seed `239438` · modelo `soul_2` (text2image_soul_v2) |
| Vídeo | Pendente — bloqueado pelo plano free (ver §Produção) |
| Formato-alvo do vídeo | 4K · 16:9 · 24fps · HDR suave · 10s |

## Emoção-alvo

Paz · liberdade · descoberta · natureza · aconchego · sofisticação · exclusividade.
**Nunca luxo exagerado. Sempre elegância natural.**

## Prompt canônico (EN — usar verbatim como base)

```
Cinematic opening shot, golden hour sunrise over Brazilian Serra da Mantiqueira
mountains. A winding empty asphalt road curves through lush Atlantic Forest
(Mata Atlântica), low fog drifting between deep-green trees, volumetric god
rays piercing the mist. Slow, extremely smooth low-altitude forward drone
travelling following the road; as the camera glides forward the vegetation
gently opens and, far in the distance on a hillside, a sophisticated Brazilian
pousada is partially revealed between the trees — natural wood and rough stone
architecture, large warm-lit windows glowing amber, discreet infinity pool,
refined tropical landscaping. The lodge stays distant and half-hidden, creating
curiosity and a sense of discovery; the camera never reaches it. A few birds
cross the sky slowly, soft wind moving the canopy. Anamorphic lens, shallow
cinematic depth of field, 24fps motion cadence, soft HDR contrast, deep greens,
earthy stone tones, natural wood, soft blue sky, warm golden light, desaturated
premium color grade, contemplative slow pace, absolute tranquility.
Photorealistic.
```

## Negative prompt (usar verbatim)

```
futuristic architecture, urban hotels, buildings, modern cars, people, fast
drone movement, artificial sky, saturated colors, excessive HDR, AI look,
deformed objects, logos, text, watermarks
```

## Especificação técnica

| Item | Valor |
|---|---|
| Câmera | Travelling frontal, drone baixo, extremamente suave, sem movimentos bruscos |
| Lente | Anamórfica, profundidade de campo cinematográfica |
| Luz | Golden hour, volumetric light, neblina atravessando raios, contraste suave |
| Paleta | Verdes profundos, madeira natural, pedra terrosa, azul suave, dourado, brancos quentes — nada saturado |
| Arquitetura | Pousada brasileira: madeira, pedra natural, janelas grandes, luz interna quente, piscina infinita discreta, paisagismo sofisticado. Realista, sem futurismo |
| Narrativa | Começa só com a estrada; a vegetação se abre; a pousada surge parcialmente ao longe; a câmera **nunca** chega nela |
| Atmosfera | Silêncio, tempo desacelerado, contemplação |

## Produção — estado atual e caminho

1. **Imagem master (2K, 16:9)** — job acima, gerada no Higgsfield (custa ~1 crédito).
   É o Identity Reference estático e o futuro `start_image` do vídeo.
2. **Vídeo master** — bloqueio atual: plano free não permite Kling 3.0 Turbo
   (modelo que caberia no saldo); Seedance/Gemini custam 14–24 créditos (> saldo
   de 10). Ao recarregar/upgrade: gerar com `seedance_2_0` (std, 4k, 10s) ou
   `kling3_0` usando a imagem master como `start_image` + este prompt.
3. **Cenas futuras** — sempre anexar a imagem master como referência de
   identidade (`image_references`) e reutilizar prompt/negative/paleta daqui.
