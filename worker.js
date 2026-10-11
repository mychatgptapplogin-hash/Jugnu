// Jugnu AI server: free Cloudflare Workers AI (10,000 free "neurons" a day, no card, no API key).
// Paste this whole file into a Cloudflare Worker, add a Workers AI binding named AI, then Deploy.
const MODEL = '@cf/google/gemma-3-12b-it';           // good multilingual model (Urdu, English; Pashto is weaker)
const ALLOW = ['https://mychatgptapplogin-hash.github.io']; // only the Jugnu app may use this server

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOW.includes(origin) ? origin : ALLOW[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
      'Vary': 'Origin'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return new Response('Jugnu AI is running.', { headers: cors });
    if (!ALLOW.includes(origin)) return json({ error: 'forbidden' }, 403, cors);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400, cors); }
    const prompt = String(body.prompt || '').slice(0, 12000);
    if (!prompt) return json({ error: 'empty' }, 400, cors);

    try {
      const out = await env.AI.run(MODEL, {
        messages: [
          { role: 'system', content: 'Follow the instructions exactly. Reply with only valid JSON, no markdown.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.4
      });
      const text = typeof out.response === 'string' ? out.response : JSON.stringify(out.response || '');
      return json({ text }, 200, cors);
    } catch (e) {
      return json({ error: 'ai_failed', detail: String(e).slice(0, 200) }, 502, cors);
    }
  }
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, 'content-type': 'application/json' } });
}
