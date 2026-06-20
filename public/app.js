/* VitalLens AI — frontend logic (vanilla JS, talks to Nebius Token Factory OpenAI-compatible API) */
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

/* ---------- settings ---------- */
const DEFAULTS = window.VITALLENS_CONFIG || {};
function cfg() {
  return {
    apiKey: localStorage.getItem('vl_key') || DEFAULTS.apiKey || '',
    baseUrl: (localStorage.getItem('vl_base') || DEFAULTS.baseUrl || 'https://api.tokenfactory.nebius.com/v1').replace(/\/$/, ''),
    model: localStorage.getItem('vl_model') || DEFAULTS.model || 'Qwen/Qwen2.5-VL-72B-Instruct',
    textModel: localStorage.getItem('vl_textmodel') || DEFAULTS.textModel || 'Qwen/Qwen3-235B-A22B-Instruct-2507'
  };
}
function refreshChip(){ const c=cfg(); document.getElementById('modelChip').textContent = '👁 '+c.model.split('/').pop()+'  ·  🧠 '+c.textModel.split('/').pop(); document.getElementById('modelChip').classList.remove('hidden'); }
function openSettings(){
  const c = cfg();
  document.getElementById('apiKeyInput').value = c.apiKey;
  document.getElementById('baseUrlInput').value = c.baseUrl;
  document.getElementById('modelInput').value = c.model;
  document.getElementById('textModelInput').value = c.textModel;
  document.getElementById('settingsModal').classList.remove('hidden');
}
function closeSettings(){ document.getElementById('settingsModal').classList.add('hidden'); }
function saveSettings(){
  localStorage.setItem('vl_key', document.getElementById('apiKeyInput').value.trim());
  localStorage.setItem('vl_base', document.getElementById('baseUrlInput').value.trim());
  localStorage.setItem('vl_model', document.getElementById('modelInput').value);
  localStorage.setItem('vl_textmodel', document.getElementById('textModelInput').value);
  refreshChip(); updateKeyBanner(); closeSettings();
}
function needKey(showErr){
  if(cfg().apiKey) return false;
  openSettings();
  if(showErr) showErr('Add your Nebius token in Settings (top right), then try again.');
  return true;
}
refreshChip();
// First-run: show a non-blocking banner (NOT a modal) so the upload area stays clickable.
function updateKeyBanner(){
  const b = document.getElementById('keyBanner');
  if(b) b.classList.toggle('hidden', !!cfg().apiKey);
}
window.addEventListener('DOMContentLoaded', updateKeyBanner);

/* ---------- file handling ---------- */
let reportImages = [];   // array of dataURLs (report pages)
let foodImage = null;

function wireDrop(dropId, inputId, onFile){
  const drop = document.getElementById(dropId), input = document.getElementById(inputId);
  drop.onclick = () => input.click();
  input.onchange = e => { if(e.target.files[0]) onFile(e.target.files[0]); };
  ['dragover','dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => { if(e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); });
}

function fileToDataURL(file){ return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); }); }

async function pdfToImages(file, maxPages=3){
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data:buf}).promise;
  const pages = Math.min(pdf.numPages, maxPages), out = [];
  for(let i=1;i<=pages;i++){
    const page = await pdf.getPage(i);
    const vp = page.getViewport({scale:2});
    const cv = document.createElement('canvas');
    cv.width = vp.width; cv.height = vp.height;
    await page.render({canvasContext:cv.getContext('2d'), viewport:vp}).promise;
    out.push(cv.toDataURL('image/jpeg', 0.85));
  }
  return out;
}

/* report upload */
wireDrop('reportDrop','reportInput', async file => {
  showReportError('');
  document.getElementById('reportPreview').classList.remove('hidden');
  document.getElementById('reportName').textContent = file.name;
  document.getElementById('reportMeta').textContent = 'Preparing…';
  try {
    if(file.type === 'application/pdf'){
      reportImages = await pdfToImages(file);
      document.getElementById('reportThumb').src = reportImages[0];
      document.getElementById('reportMeta').textContent = `PDF · ${reportImages.length} page(s) ready`;
    } else {
      const url = await fileToDataURL(file);
      reportImages = [url];
      document.getElementById('reportThumb').src = url;
      document.getElementById('reportMeta').textContent = 'Image ready';
    }
  } catch(err){ showReportError('Could not read file: ' + err.message); }
});

/* food upload */
wireDrop('foodDrop','foodInput', async file => {
  foodImage = await fileToDataURL(file);
  const t = document.getElementById('foodThumb'); t.src = foodImage; t.classList.remove('hidden');
  const b = document.getElementById('foodBtn'); b.classList.remove('hidden'); b.classList.add('flex');
});

/* ---------- Nebius API ---------- */
async function chat(messages, {json=false, maxTokens=2000, model=null}={}){
  const c = cfg();
  if(!c.apiKey) throw new Error('No API token set. Open ⚙️ Settings and paste your Nebius token.');
  const body = { model: model || c.model, messages, temperature:0.4, max_tokens:maxTokens };
  if(json) body.response_format = { type:'json_object' };
  const res = await fetch(c.baseUrl + '/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + c.apiKey },
    body: JSON.stringify(body)
  });
  if(!res.ok){ const t = await res.text(); throw new Error(`API ${res.status}: ${t.slice(0,300)}`); }
  const data = await res.json();
  return data.choices[0].message.content;
}

function parseJSON(text){
  if(!text) throw new Error('Empty response from model.');
  let t = String(text).trim();
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();        // strip reasoning blocks
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);          // strip markdown code fences
  if(fence) t = fence[1].trim();
  try { return JSON.parse(t); } catch(_){}
  // balanced-brace scan from the first '{'
  const start = t.indexOf('{');
  if(start >= 0){
    let depth=0, inStr=false, escd=false;
    for(let i=start;i<t.length;i++){
      const c=t[i];
      if(inStr){ if(escd) escd=false; else if(c==='\\') escd=true; else if(c==='"') inStr=false; }
      else if(c==='"') inStr=true;
      else if(c==='{') depth++;
      else if(c==='}'){ if(--depth===0){ try { return JSON.parse(t.slice(start,i+1)); } catch(_){} } }
    }
    const last = t.lastIndexOf('}');                              // salvage truncated output
    if(last>start){ try { return JSON.parse(t.slice(start,last+1)); } catch(_){} }
  }
  throw new Error('Model did not return valid JSON.');
}

// Request JSON with one automatic corrective retry — makes the pipeline demo-safe.
async function chatJSON(messages, opts){
  const raw = await chat(messages, { ...opts, json:true });
  try { return parseJSON(raw); }
  catch(e){
    const retry = await chat([
      ...messages,
      { role:'assistant', content: raw.slice(0, 4000) },
      { role:'user', content:'Your previous reply was not valid JSON. Respond again with ONLY the JSON object — no markdown fences, no commentary, no thinking.' }
    ], { ...opts, json:true });
    return parseJSON(retry);
  }
}

function imageParts(urls){ return urls.map(u => ({ type:'image_url', image_url:{ url:u } })); }

/* ---------- analyze report ---------- */
// STEP 1 — vision model: pure data extraction (no advice)
const EXTRACT_PROMPT = `You are a medical lab-report data extractor. Read the attached report image(s) and extract the data exactly as printed. Do NOT interpret or give advice.
Return ONLY valid JSON:
{
 "patient": "any visible age / sex / relevant context, else empty string",
 "report_type": "e.g. Complete Blood Count, Lipid Panel, else empty",
 "markers": [{"marker":"e.g. Hemoglobin","value":"e.g. 13.5","unit":"e.g. g/dL","reference":"normal range if shown else empty","flag":"low|high|normal|borderline|unknown"}],
 "notes": "any other clinically relevant printed text"
}
If a value is unreadable, omit that marker. No text outside the JSON.`;

// STEP 2 — text reasoning model: explanation + personalized plan (no image)
const PLAN_PROMPT = `You are a careful, encouraging health coach who explains lab results to a layperson. You are given structured lab data that was already extracted from a report. Explain it and build a personalized plan.
Return ONLY valid JSON with this exact shape:
{
 "health_score": 0-100 integer (overall wellness from these labs; 100 = excellent, lower = more issues),
 "health_label": "2-4 word friendly status, e.g. Needs some care / Pretty good / Looking great",
 "summary": "2-4 sentence plain-language overview of overall health from these results",
 "concerns": ["short phrases for anything out of range or worth attention"],
 "findings": [{"marker":"Hemoglobin","value":"13.5 g/dL","status":"normal|low|high|borderline","position": 0-100 integer where the value sits on the healthy spectrum (0 = far too low, 50 = ideal/healthy middle, 100 = far too high),"meaning":"one plain sentence a non-doctor understands"}],
 "diet": {"goal":"one line", "eat":["food/habit","..."], "avoid":["...","..."], "sample_day":[{"meal":"Breakfast","time":"7:30 AM","items":"..."},{"meal":"Lunch","time":"1:00 PM","items":"..."},{"meal":"Dinner","time":"7:30 PM","items":"..."}]},
 "exercise": [{"activity":"...","frequency":"e.g. 5x/week","detail":"one line"}],
 "routine": [{"time":"6:00 AM","title":"Morning sunlight","detail":"15 min outside for vitamin D"},{"time":"...","title":"...","detail":"..."}]
}
Build "findings" from EVERY extracted marker (combine value+unit into one string). Make "routine" a realistic full day (wake, sunlight/vitamin D, hydration, meals, movement, screen breaks, wind-down, sleep). Tailor diet and exercise to the findings (e.g. low vitamin D, high cholesterol, anemia, high glucose). Be specific and encouraging. No text outside the JSON.`;

async function analyzeReport(){
  if(!reportImages.length){ showReportError('Upload a report first.'); return; }
  if(needKey(showReportError)) return;
  toggleSpin('analyzeSpin','analyzeLabel','analyzeBtn', true);
  showReportError('');
  const label = document.getElementById('analyzeLabel');
  try {
    // Step 1: vision extraction
    label.textContent = '📖 Reading report…';
    const extracted = await chatJSON([
      { role:'user', content:[ { type:'text', text:EXTRACT_PROMPT }, ...imageParts(reportImages) ] }
    ], { maxTokens:2200, model: cfg().model });

    // Step 2: text reasoning -> plan
    label.textContent = '🧠 Building your plan…';
    const data = await chatJSON([
      { role:'system', content:'You are a precise health assistant that always responds with a single valid JSON object only — no markdown, no extra text.' },
      { role:'user', content: PLAN_PROMPT + '\n\nExtracted lab data:\n' + JSON.stringify(extracted) }
    ], { maxTokens:4000, model: cfg().textModel });

    reportCtx = { extracted, plan: data };   // ground the chat in this report
    chatHistory = [];
    document.getElementById('chatLog').innerHTML = '';
    renderResults(data);
    document.getElementById('results').classList.remove('hidden');
    document.getElementById('results').scrollIntoView({behavior:'smooth'});
  } catch(err){
    showReportError(err.message);
  } finally {
    toggleSpin('analyzeSpin','analyzeLabel','analyzeBtn', false);
  }
}

const STATUS_STYLE = {
  normal:'bg-green-50 text-green-700 border-green-200',
  low:'bg-amber-50 text-amber-700 border-amber-200',
  high:'bg-red-50 text-red-700 border-red-200',
  borderline:'bg-orange-50 text-orange-700 border-orange-200'
};

// visual helpers for low-literacy comprehension
function scoreVisual(s){
  s = Math.max(0, Math.min(100, parseInt(s)));
  if(s>=75) return {face:'😄', color:'#0b9579', label:'Looking great'};
  if(s>=55) return {face:'🙂', color:'#0fae8e', label:'Pretty good'};
  if(s>=35) return {face:'😐', color:'#f59e0b', label:'Needs some care'};
  return {face:'😟', color:'#ef4444', label:'Needs attention'};
}
const STATUS_VISUAL = {
  normal:{arrow:'✅', word:'Good', color:'#0b9579', pos:50},
  low:{arrow:'🔻', word:'Low', color:'#d97706', pos:15},
  high:{arrow:'🔺', word:'High', color:'#dc2626', pos:85},
  borderline:{arrow:'⚠️', word:'Borderline', color:'#ea580c', pos:30}
};

function renderResults(d){
  // Overall health meter
  const hm = document.getElementById('healthMeter');
  if(typeof d.health_score !== 'undefined' && d.health_score !== null){
    const sv = scoreVisual(d.health_score);
    const score = Math.max(0, Math.min(100, parseInt(d.health_score)));
    hm.classList.remove('hidden');
    hm.innerHTML = `<div class="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex items-center gap-4 sm:gap-5">
      <div class="text-5xl sm:text-6xl leading-none">${sv.face}</div>
      <div class="flex-1">
        <div class="flex items-baseline justify-between mb-1.5 flex-wrap gap-1">
          <span class="font-bold">Your overall health</span>
          <span class="text-sm font-bold" style="color:${sv.color}">${esc(d.health_label||sv.label)} · ${score}/100</span>
        </div>
        <div class="h-3.5 rounded-full bg-slate-200 overflow-hidden">
          <div class="h-full rounded-full transition-all" style="width:${score}%;background:${sv.color}"></div>
        </div>
      </div></div>`;
  } else hm.classList.add('hidden');

  // Visual marker cards (arrow + Low–Normal–High bar with a pointer)
  document.getElementById('findingsVisual').innerHTML = (d.findings||[]).map(f => {
    const st = (f.status||'normal').toLowerCase();
    const v = STATUS_VISUAL[st] || STATUS_VISUAL.normal;
    let pos = (typeof f.position === 'number') ? f.position : (parseInt(f.position) || v.pos);
    pos = Math.max(3, Math.min(97, pos));
    return `<div class="border border-slate-200 rounded-xl p-4">
      <div class="flex items-center justify-between mb-1 gap-2">
        <span class="font-semibold text-sm">${esc(f.marker||'')}</span>
        <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:${v.color}1a;color:${v.color}">${v.arrow} ${v.word}</span>
      </div>
      <div class="text-lg font-extrabold mb-2.5" style="color:${v.color}">${esc(f.value||'')}</div>
      <div class="relative h-2.5 rounded-full mb-1" style="background:linear-gradient(90deg,#fcd34d 0 33%,#6ee7b7 33% 67%,#fca5a5 67% 100%)">
        <div class="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 shadow" style="left:calc(${pos}% - 7px);border-color:${v.color}"></div>
      </div>
      <div class="flex justify-between text-[10px] font-medium text-slate-400 mb-2"><span>Low</span><span>Normal</span><span>High</span></div>
      <div class="text-xs text-slate-600 leading-snug">${esc(f.meaning||'')}</div>
    </div>`;
  }).join('') || `<div class="text-slate-400 text-sm">No individual markers extracted.</div>`;

  document.getElementById('summaryBox').innerHTML = marked.parse(d.summary || '');

  const cb = document.getElementById('concernsBox');
  if(d.concerns && d.concerns.length){
    cb.classList.remove('hidden');
    cb.innerHTML = `<div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div class="font-semibold text-amber-800 text-sm mb-2">⚠️ Worth your attention</div>
      <ul class="list-disc pl-5 text-sm text-amber-800 space-y-1">${d.concerns.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>`;
  } else cb.classList.add('hidden');

  document.getElementById('findingsBody').innerHTML = (d.findings||[]).map(f => {
    const st = (f.status||'normal').toLowerCase();
    const cls = STATUS_STYLE[st] || STATUS_STYLE.normal;
    return `<tr class="border-b border-slate-100">
      <td class="py-3 pr-4 font-medium">${esc(f.marker||'')}</td>
      <td class="py-3 pr-4 font-mono text-[13px]">${esc(f.value||'')}</td>
      <td class="py-3 pr-4"><span class="text-xs px-2 py-0.5 rounded-full border capitalize ${cls}">${esc(st)}</span></td>
      <td class="py-3 text-slate-600">${esc(f.meaning||'')}</td></tr>`;
  }).join('') || `<tr><td colspan="4" class="py-4 text-slate-400 text-sm">No individual markers extracted.</td></tr>`;

  // Diet
  const diet = d.diet || {};
  document.getElementById('tab-diet').innerHTML = `
    ${diet.goal?`<p class="text-sm font-semibold text-brand-700 mb-4">🎯 ${esc(diet.goal)}</p>`:''}
    <div class="grid sm:grid-cols-2 gap-4 mb-6">
      <div class="bg-green-50 border border-green-100 rounded-xl p-4">
        <div class="font-semibold text-green-800 text-sm mb-2">✅ Eat more</div>
        <ul class="list-disc pl-5 text-sm text-slate-700 space-y-1">${(diet.eat||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="bg-red-50 border border-red-100 rounded-xl p-4">
        <div class="font-semibold text-red-800 text-sm mb-2">🚫 Limit</div>
        <ul class="list-disc pl-5 text-sm text-slate-700 space-y-1">${(diet.avoid||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
    </div>
    ${(diet.sample_day&&diet.sample_day.length)?`<div class="font-semibold text-sm mb-2">Sample day</div>
    <div class="space-y-2">${diet.sample_day.map(m=>`<div class="flex gap-3 items-start bg-slate-50 rounded-lg p-3">
      <div class="text-xs font-mono text-brand-600 w-20 shrink-0 pt-0.5">${esc(m.time||'')}</div>
      <div><span class="font-semibold text-sm">${esc(m.meal||'')}</span><div class="text-sm text-slate-600">${esc(m.items||'')}</div></div></div>`).join('')}</div>`:''}`;

  // Exercise
  document.getElementById('tab-exercise').innerHTML = `<div class="grid sm:grid-cols-2 gap-3">
    ${(d.exercise||[]).map(e=>`<div class="border border-slate-200 rounded-xl p-4">
      <div class="font-semibold">${esc(e.activity||'')}</div>
      <div class="text-xs text-brand-600 font-medium mt-0.5">${esc(e.frequency||'')}</div>
      <div class="text-sm text-slate-600 mt-1">${esc(e.detail||'')}</div></div>`).join('')}</div>`;

  // Routine timeline
  routineData = d.routine || [];
  document.getElementById('tab-routine').innerHTML = `<div class="relative pl-6">
    <div class="absolute left-[7px] top-1 bottom-1 w-0.5 bg-brand-100"></div>
    ${routineData.map(r=>`<div class="relative mb-4">
      <div class="absolute -left-[22px] top-1 w-3.5 h-3.5 rounded-full bg-brand-500 border-2 border-white shadow"></div>
      <div class="text-xs font-mono text-brand-600 font-semibold">${esc(r.time||'')}</div>
      <div class="font-semibold text-sm">${esc(r.title||'')}</div>
      <div class="text-sm text-slate-600">${esc(r.detail||'')}</div></div>`).join('')}</div>`;
}

/* ---------- food analysis ---------- */
const FOOD_PROMPT = `You are a nutrition assistant. Look at this meal photo and estimate its nutrition for one serving.
Return ONLY valid JSON:
{"dish":"name of the food","calories":"e.g. ~520 kcal","protein":"e.g. 22 g","carbs":"e.g. 60 g","fat":"e.g. 18 g","healthScore": 1-10 integer,"verdict":"one short sentence","suggestion":"one specific tip to make it healthier or what to pair/skip"}
No text outside the JSON.`;

async function analyzeFood(){
  if(!foodImage) return;
  if(needKey(m=>{ const box=document.getElementById('foodResult'); document.getElementById('foodPlaceholder').classList.add('hidden'); box.classList.remove('hidden'); box.innerHTML=`<div class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">${esc(m)}</div>`; })) return;
  toggleSpin('foodSpin','foodLabel','foodBtn', true);
  try {
    const f = await chatJSON([
      { role:'user', content:[ { type:'text', text:FOOD_PROMPT }, { type:'image_url', image_url:{url:foodImage} } ] }
    ], { maxTokens:700, model: cfg().model });
    const score = Math.max(1, Math.min(10, parseInt(f.healthScore)||5));
    const scoreColor = score>=7?'text-green-600':score>=4?'text-amber-600':'text-red-600';
    document.getElementById('foodPlaceholder').classList.add('hidden');
    const box = document.getElementById('foodResult');
    box.classList.remove('hidden');
    box.innerHTML = `<div class="fade-in">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-lg">${esc(f.dish||'Your meal')}</h3>
        <div class="text-right"><div class="text-3xl font-extrabold ${scoreColor}">${score}<span class="text-base text-slate-400">/10</span></div><div class="text-[10px] uppercase tracking-wide text-slate-400">health score</div></div>
      </div>
      <div class="grid grid-cols-4 gap-2 mb-4 text-center">
        ${[['Calories',f.calories],['Protein',f.protein],['Carbs',f.carbs],['Fat',f.fat]].map(([k,v])=>`<div class="bg-slate-50 rounded-lg py-2"><div class="text-sm font-bold">${esc(v||'—')}</div><div class="text-[10px] uppercase tracking-wide text-slate-400">${k}</div></div>`).join('')}
      </div>
      <div class="bg-slate-50 rounded-xl p-4 text-sm space-y-2">
        <p class="text-slate-700">${esc(f.verdict||'')}</p>
        <p class="text-brand-700"><b>💡 Tip:</b> ${esc(f.suggestion||'')}</p>
      </div></div>`;
  } catch(err){
    document.getElementById('foodPlaceholder').classList.add('hidden');
    const box = document.getElementById('foodResult'); box.classList.remove('hidden');
    box.innerHTML = `<div class="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">${esc(err.message)}</div>`;
  } finally {
    toggleSpin('foodSpin','foodLabel','foodBtn', false);
  }
}

/* ---------- reminders ---------- */
let routineData = [];
async function enableReminders(){
  if(!('Notification' in window)){ alert('Notifications not supported in this browser.'); return; }
  const perm = await Notification.requestPermission();
  const btn = document.getElementById('remindBtn');
  if(perm === 'granted'){
    new Notification('VitalLens reminders on ✅', { body:'We\'ll nudge you through your daily routine.' });
    btn.textContent = '✅ Reminders enabled'; btn.disabled = true;
    btn.classList.add('opacity-60');
    // Demo: fire the first routine item shortly so the user sees it work.
    if(routineData[0]){
      setTimeout(()=> new Notification('🌅 ' + (routineData[0].title||'Routine'), { body: routineData[0].detail||'' }), 4000);
    }
  } else { btn.textContent = 'Reminders blocked'; }
}

/* ---------- tabs ---------- */
document.getElementById('planTabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn'); if(!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b=>{ b.className='tab-btn bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold'; });
  btn.className = 'tab-btn bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-semibold';
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.add('hidden'));
  document.getElementById('tab-'+btn.dataset.tab).classList.remove('hidden');
});

/* ---------- ask about your report (chat) ---------- */
let reportCtx = null;      // { extracted, plan } set after analysis
let chatHistory = [];      // [{role, content}] recent turns

function chatBubble(role, html){
  const log = document.getElementById('chatLog');
  const empty = document.getElementById('chatEmpty'); if(empty) empty.remove();
  const wrap = document.createElement('div');
  wrap.className = 'flex items-end gap-2 fade-in ' + (role==='user' ? 'justify-end' : 'justify-start');
  const avatar = `<div class="shrink-0 w-8 h-8 rounded-full bg-brand-500 text-white grid place-items-center text-sm shadow-sm">🩺</div>`;
  const bubble = role==='user'
    ? `<div class="bg-brand-500 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm max-w-[82%] shadow-sm break-words">${html}</div>`
    : `<div class="bg-white text-slate-800 border border-slate-100 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm max-w-[82%] shadow-sm prose-mini break-words">${html}</div>`;
  wrap.innerHTML = role==='user' ? bubble : (avatar + bubble);
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
  return wrap.lastElementChild;
}
const TYPING_HTML = '<span class="inline-flex gap-1 items-center py-1"><span class="tdot"></span><span class="tdot"></span><span class="tdot"></span></span>';

async function sendChat(text){
  text = (text||'').trim();
  if(!text) return;
  if(needKey(m=>chatBubble('bot', esc(m)))) return;
  document.getElementById('chatSuggest').classList.add('hidden');
  chatBubble('user', esc(text));
  document.getElementById('chatInput').value = '';
  const typing = chatBubble('bot', '<span class="inline-flex gap-1"><span class="w-1.5 h-1.5 bg-slate-400 rounded-full spin"></span> thinking…</span>');
  document.getElementById('chatSend').disabled = true;
  try {
    const ctx = reportCtx ? {
      summary: reportCtx.plan?.summary,
      concerns: reportCtx.plan?.concerns,
      findings: reportCtx.plan?.findings,
      diet_goal: reportCtx.plan?.diet?.goal
    } : {};
    const messages = [
      { role:'system', content:`You are VitalLens, a warm, careful health assistant. Answer the user's question about THEIR lab report in simple, plain language anyone can understand. Keep it short (2-4 sentences). Be reassuring and practical, and suggest one concrete next step when relevant. Do NOT diagnose or prescribe medication; for anything serious or uncertain, gently advise seeing a doctor. The user's report context (JSON): ${JSON.stringify(ctx)}` },
      ...chatHistory.slice(-6),
      { role:'user', content:text }
    ];
    const answer = await chat(messages, { maxTokens:500, model: cfg().textModel });
    typing.innerHTML = marked.parse(answer || '');
    chatHistory.push({role:'user', content:text}, {role:'assistant', content:answer});
  } catch(err){
    typing.innerHTML = `<span class="text-red-600">${esc(err.message)}</span>`;
  } finally {
    document.getElementById('chatSend').disabled = false;
    document.getElementById('chatLog').scrollTop = document.getElementById('chatLog').scrollHeight;
  }
}

document.getElementById('chatForm').addEventListener('submit', e => {
  e.preventDefault();
  sendChat(document.getElementById('chatInput').value);
});
document.getElementById('chatSuggest').addEventListener('click', e => {
  const chip = e.target.closest('.chip'); if(!chip) return;
  sendChat(chip.textContent);
});

/* ---------- helpers ---------- */
function esc(s){ return String(s??'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function showReportError(msg){ const el=document.getElementById('reportError'); if(msg){ el.textContent=msg; el.classList.remove('hidden'); } else el.classList.add('hidden'); }
function toggleSpin(spinId,labelId,btnId,on){
  document.getElementById(spinId).classList.toggle('hidden', !on);
  document.getElementById(btnId).disabled = on;
  document.getElementById(btnId).classList.toggle('opacity-70', on);
  const labels = { analyzeLabel:['🔍 Analyze report','Analyzing…'], foodLabel:['🔬 Analyze meal','Analyzing…'] };
  if(labels[labelId]) document.getElementById(labelId).textContent = on ? labels[labelId][1] : labels[labelId][0];
}
