const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';const MODELS=['@cf/meta/llama-3.3-70b-instruct-fp8-fast','@cf/openai/gpt-oss-120b','@cf/openai/gpt-oss-20b','@cf/meta/llama-4-scout-17b-16e-instruct','@cf/qwen/qwen3-30b-a3b-fp8','@cf/google/gemma-3-12b-it','@cf/mistralai/mistral-small-3.1-24b-instruct'];const STT='@cf/openai/whisper-large-v3-turbo';const ALLOW=['https://mychatgptapplogin-hash.github.io'];const SYS='Follow the instructions exactly. Reply with only valid JSON, no markdown.';
function json(o,s,h){return new Response(JSON.stringify(o),{status:s,headers:{...h,'content-type':'application/json'}});}
function b64(buf){let s='';const a=new Uint8Array(buf);for(let i=0;i<a.length;i+=32768){s+=String.fromCharCode.apply(null,a.subarray(i,i+32768));}return btoa(s);}
function pick(o){if(!o)return '';if(typeof o==='string')return o;if(typeof o.response==='string')return o.response;if(o.response&&typeof o.response==='object')return JSON.stringify(o.response);if(o.choices&&o.choices[0]){const c=o.choices[0];return (c.message&&c.message.content)||c.text||'';}if(Array.isArray(o.output)){for(const it of o.output){if(it&&it.type==='message'&&Array.isArray(it.content)){for(const c of it.content){if(c&&c.type==='output_text')return c.text;}}}}if(o.output_text)return o.output_text;return JSON.stringify(o).slice(0,3000);}
export default {async fetch(req,env){const origin=req.headers.get('Origin')||'';const cors={'Access-Control-Allow-Origin':ALLOW.includes(origin)?origin:ALLOW[0],'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, x-lang','Vary':'Origin'};
if(req.method==='OPTIONS'){return new Response(null,{headers:cors});}
if(req.method!=='POST'){return new Response('Jugnu AI is running.',{headers:cors});}
if(!ALLOW.includes(origin)){return json({error:'forbidden'},403,cors);}
const path=new URL(req.url).pathname;
if(path.indexOf('/hf/')>=0){const api=path.split('/hf/')[1];if(['pashto_asr','urdu_asr','qehwa'].indexOf(api)<0){return json({error:'not_found'},404,cors);}
if(!env.HF_SPACE||!env.JUGNU_KEY){return json({error:'hf_off'},503,cors);}
let data;if(api==='qehwa'){let b;try{b=await req.json();}catch(e){return json({error:'bad_json'},400,cors);}data=[String(b.system||'').slice(0,2000),String(b.user||'').slice(0,4000),Math.min(Math.max(parseInt(b.max||256,10)||256,16),600),env.JUGNU_KEY];}
else{const buf=await req.arrayBuffer();if(!buf.byteLength||buf.byteLength>8000000){return json({error:'bad_audio'},400,cors);}data=[b64(buf),env.JUGNU_KEY];}
const base='https://'+env.HF_SPACE+'.hf.space/gradio_api/call/'+api;const h={'content-type':'application/json'};if(env.HF_TOKEN){h.Authorization='Bearer '+env.HF_TOKEN;}
try{const r=await fetch(base,{method:'POST',headers:h,body:JSON.stringify({data})});if(!r.ok){return json({error:'hf_http',status:r.status},502,cors);}const ev=(await r.json()).event_id;
const s=await fetch(base+'/'+ev,{headers:h});const t=await s.text();const lines=t.split('\n');let kind='',out=null;
for(const ln of lines){if(ln.indexOf('event:')===0){kind=ln.slice(6).trim();}else if(ln.indexOf('data:')===0&&kind==='complete'){try{const d=JSON.parse(ln.slice(5).trim());out=Array.isArray(d)?d[0]:d;}catch(e){}}else if(kind==='error'){return json({error:'hf_error',detail:ln.slice(0,200)},502,cors);}}
if(out===null){return json({error:'hf_empty'},502,cors);}return json({text:String(out).trim(),via:'hf'},200,cors);}catch(e){return json({error:'hf_failed',detail:String(e).slice(0,200)},502,cors);}}
if(path.endsWith('/transcribe')){const buf=await req.arrayBuffer();if(!buf.byteLength||buf.byteLength>15000000){return json({error:'bad_audio'},400,cors);}const lang=(req.headers.get('x-lang')||'').slice(0,2);try{const input={audio:b64(buf)};if(['ur','ps','en'].includes(lang)){input.language=lang;}const out=await env.AI.run(STT,input);return json({text:String(out.text||'').trim()},200,cors);}catch(e){return json({error:'stt_failed',detail:String(e).slice(0,200)},502,cors);}}
let body;try{body=await req.json();}catch(e){return json({error:'bad_json'},400,cors);}
const prompt=String(body.prompt||'').slice(0,14000);if(!prompt){return json({error:'empty'},400,cors);}
const model=MODELS.includes(body.model)?body.model:MODEL;
try{let out;if(model.indexOf('gpt-oss')>=0){const eff=['low','medium','high'].includes(body.effort)?body.effort:'low';out=await env.AI.run(model,{instructions:SYS,input:prompt,reasoning:{effort:eff}});}else{out=await env.AI.run(model,{messages:[{role:'system',content:SYS},{role:'user',content:prompt}],max_tokens:700,temperature:0.3});}
return json({text:pick(out),model},200,cors);}catch(e){return json({error:'ai_failed',detail:String(e).slice(0,300)},502,cors);}}};
