# Face Vision AI

Demonstração educacional de **detecção e rastreamento facial em tempo real** com o
[MediaPipe Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker).

> Faz **detecção + landmarks + rastreamento + análise de movimento facial**.
> Por padrão não identifica pessoas. Existe um cadastro **opcional, local e com consentimento** (veja abaixo).
> Nunca armazena imagens.

## Como executar

A câmera só funciona em **HTTPS ou `localhost`**, e módulos ES não abrem direto por `file://`.
Sirva a pasta com qualquer servidor estático:

```bash
cd face-vision
python -m http.server 8080
```

Abra <http://localhost:8080> e clique em **INICIAR CÂMERA**.

Alternativa com Node: `npx serve .`

É necessária conexão com a internet na primeira carga (biblioteca e modelo vêm de CDN pública:
jsDelivr e storage.googleapis.com). Use Chrome, Edge, Firefox ou Safari atuais.

## Estrutura

```
face-vision/
├── index.html
├── style.css
├── README.md
└── src/
    ├── main.js               # orquestra câmera, loop e eventos
    ├── config.js             # URLs do MediaPipe, mensagens
    ├── services/
    │   ├── faceTracker.js    # Face Landmarker (VIDEO mode, GPU com fallback CPU)
    │   └── camera.js         # getUserMedia e tradução de erros
    ├── ui/
    │   ├── renderer.js       # desenho no canvas (malha, contornos, pontos, rótulos)
    │   └── dashboard.js      # atualização do DOM
    └── utils/
        ├── analysis.js       # cabeça, boca, olhos, íris, expressões
        └── metrics.js        # FPS, latência, taxa de detecção
```

## O que é real e o que é estimado

| Painel | Origem |
| --- | --- |
| Landmarks, X/Y/Z do inspector | Retorno direto do modelo (478 pontos por face) |
| Barras de expressão | Blendshapes reais do modelo; “Neutro” é derivado (1 − maior pontuação) |
| FPS, latência | Medidos pelo próprio app (`performance.now`) |
| Taxa de detecção | Fração dos últimos 30 frames com rosto (o modelo não expõe “confiança” por frame) |
| Rotação, inclinação, pitch, olhar | Estimativas geométricas aproximadas a partir dos landmarks |

Esquerda/direita seguem a imagem espelhada na tela. Apenas a **primeira face** é analisada; o modelo
detecta até 2 rostos apenas para avisar “Mais de um rosto detectado”.

## Cadastro opcional de rostos (JSON)

Seção “Faces cadastradas”: cadastra pessoas **que autorizaram** (checkbox obrigatório). Cada cadastro guarda
apenas uma assinatura numérica dos landmarks (sem fotos) num JSON no `localStorage` do navegador, com
exportar/importar/remover/apagar tudo. Ao ligar “Reconhecer rostos cadastrados”, a primeira face é comparada
só com os cadastrados; quem não corresponde aparece como “Não cadastrado”.

É uma comparação geométrica simples e **aproximada** (varia com ângulo, expressão e distância); ajuste o
“Rigor” e não use para segurança ou controle de acesso. Cada navegador/domínio tem seu próprio banco;
use Exportar/Importar JSON para levar os cadastros a outro lugar.

## Privacidade

Processamento local no navegador; nenhum frame é enviado a servidor, e nada é salvo automaticamente.
“Capturar frame” baixa um PNG para o seu dispositivo **somente quando você clica**.

## Recursos

Header com status, hero, painel de análise com camadas ligáveis, rótulos de regiões, Face Analytics,
Face Movement, Facial Expression Analysis, Landmark Inspector, performance em tempo real,
Demo Mode, Presentation Mode (Esc para sair), fullscreen, captura opcional, tema claro/escuro,
layout responsivo e navegação por teclado.
