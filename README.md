# Sistema de OS de Manutenção

Abertura de OS por página web (celular, **foto obrigatória**) → vira uma Issue no GitHub.
A manutenção atualiza/fecha pela página `manutencao.html`. `data/os.csv` é atualizado automaticamente.

## Colocar no ar (≈15 min)
1. Crie o repositório no GitHub e suba esta pasta (branch `main`). Em *Settings → Pages* escolha **GitHub Actions**.
2. `./scripts/criar-labels.sh SEU-USUARIO/os-manutencao`
3. Crie um token *fine-grained* só para este repositório (Contents e Issues: read/write).
4. Cloudflare Worker (grátis): em `worker/`, ajuste `wrangler.toml` e rode
   `npx wrangler secret put GH_TOKEN`, `PIN_ABRIR`, `PIN_MANUT` e `npx wrangler deploy`.
5. Coloque a URL do Worker em `web/config.js` e dê push. Links: `https://SEU-USUARIO.github.io/os-manutencao/` e `.../manutencao.html`.

## Segurança
- O repositório é público: **fotos, TAGs e OS ficam visíveis a qualquer pessoa**. Não fotografe documentos/pessoas. Para tornar privado, basta mudar a visibilidade (Pages privado exige plano pago; a página pode ficar em Cloudflare Pages).
- Os PINs ficam só no Worker. Troque-os se vazarem.
- `web/tags.json` tem só TAG, máquina e status (sem série, NF ou valor).
