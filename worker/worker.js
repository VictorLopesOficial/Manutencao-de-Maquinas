// Cloudflare Worker: recebe o formulário, guarda a foto no repositório e cria/atualiza a Issue (OS).
// Variáveis (wrangler secret / vars): GH_TOKEN, REPO ("dono/repo"), PIN_ABRIR, PIN_MANUT, ALLOWED_ORIGIN
const STATUS = {
  "aguardando-analise": "Aguardando análise",
  "em-manutencao": "Em manutenção",
  "aguardando-pecas": "Aguardando peças",
  "manutencao-externa": "Manutenção externa",
  "liberado-para-uso": "Liberado para uso",
  "perda-total": "Perda total",
};
const FINAIS = ["liberado-para-uso", "perda-total"];

const cors = (env) => ({
  "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
});
const json = (env, obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors(env) } });

const gh = (env, path, init = {}) =>
  fetch(`https://api.github.com/repos/${env.REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "os-manutencao",
      ...(init.headers || {}),
    },
  });

const limpa = (s, n = 500) => String(s ?? "").replace(/[|\r\n]+/g, " ").trim().slice(0, n);

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    const url = new URL(req.url);
    try {
      if (req.method === "GET" && url.pathname === "/abertas") {
        if (url.searchParams.get("pin") !== env.PIN_MANUT) return json(env, { erro: "PIN inválido" }, 401);
        const r = await gh(env, "/issues?state=open&labels=os&per_page=100");
        const list = (await r.json()).map((i) => ({ numero: i.number, titulo: i.title, criada: i.created_at }));
        return json(env, list);
      }
      if (req.method !== "POST") return json(env, { erro: "Não encontrado" }, 404);
      const b = await req.json();

      if (url.pathname === "/abrir") {
        if (b.pin !== env.PIN_ABRIR) return json(env, { erro: "PIN inválido" }, 401);
        if (!b.tag || !b.obra || !b.ocorrencia || !b.nome) return json(env, { erro: "Preencha todos os campos" }, 400);
        if (!b.foto || !/^[A-Za-z0-9+/=]+$/.test(b.foto) || b.foto.length < 2000)
          return json(env, { erro: "A foto é obrigatória" }, 400);
        if (b.foto.length > 4_000_000) return json(env, { erro: "Foto muito grande" }, 413);

        const tag = limpa(b.tag, 20).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
        const caminho = `fotos/${new Date().toISOString().slice(0, 10)}-${tag}-${Date.now()}.jpg`;
        const up = await gh(env, `/contents/${caminho}`, {
          method: "PUT",
          body: JSON.stringify({ message: `Foto da OS ${tag}`, content: b.foto }),
        });
        if (!up.ok) return json(env, { erro: "Falha ao salvar a foto" }, 502);
        const foto = `https://raw.githubusercontent.com/${env.REPO}/main/${caminho}`;

        const corpo =
          `| Campo | Valor |\n|---|---|\n| TAG | ${tag} |\n| Máquina | ${limpa(b.maquina, 80)} |\n` +
          `| Obra de origem | ${limpa(b.obra, 80)} |\n| Causa da OS | ${limpa(b.causa, 80)} |\n` +
          `| Solicitante | ${limpa(b.nome, 80)} |\n\n**Ocorrência:** ${limpa(b.ocorrencia, 1000)}\n\n` +
          `![foto da abertura](${foto})`;
        const is = await gh(env, "/issues", {
          method: "POST",
          body: JSON.stringify({
            title: `OS ${tag} - ${limpa(b.maquina, 60)}`,
            body: corpo,
            labels: ["os", "aguardando-analise"],
          }),
        });
        if (!is.ok) return json(env, { erro: "Falha ao criar a OS" }, 502);
        const issue = await is.json();
        return json(env, { ok: true, numero: issue.number });
      }

      if (url.pathname === "/fechar") {
        if (b.pin !== env.PIN_MANUT) return json(env, { erro: "PIN inválido" }, 401);
        const n = parseInt(b.numero, 10);
        if (!n || !STATUS[b.status]) return json(env, { erro: "Dados inválidos" }, 400);
        const tabela =
          `### Atualização da manutenção\n| Campo | Valor |\n|---|---|\n| Status | ${STATUS[b.status]} |\n` +
          `| Causa analisada | ${limpa(b.causa_analisada, 100)} |\n| Defeito / considerações | ${limpa(b.defeito, 500)} |\n` +
          `| Estado de conservação | ${limpa(b.conservacao, 60)} |\n| Severidade | ${limpa(b.severidade, 60)} |\n` +
          `| Peças substituídas | ${limpa(b.pecas, 300)} |\n| Pendências | ${limpa(b.pendencias, 300)} |\n` +
          `| Data de liberação | ${limpa(b.liberacao, 20)} |`;
        await gh(env, `/issues/${n}/comments`, { method: "POST", body: JSON.stringify({ body: tabela }) });
        const labels = ["os", b.status];
        const patch = { labels };
        if (FINAIS.includes(b.status)) patch.state = "closed";
        const r = await gh(env, `/issues/${n}`, { method: "PATCH", body: JSON.stringify(patch) });
        if (!r.ok) return json(env, { erro: "Falha ao atualizar a OS" }, 502);
        return json(env, { ok: true, fechada: FINAIS.includes(b.status) });
      }
      return json(env, { erro: "Não encontrado" }, 404);
    } catch (e) {
      return json(env, { erro: "Erro interno" }, 500);
    }
  },
};
