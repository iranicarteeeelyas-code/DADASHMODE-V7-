// Secondary views: director, studio, subtitles, voice, data, log, phones, settings
import { CFG, PHASES, TIMELINE, SHOTS, PROPS, SAFETY, GEMINI, RIDDLES, TARGETS, FATE, BITES } from '../shared/data.js';
import { B, esc } from './deck.js';
import { PRESETS } from '../shared/subs.js';
import { SFX_NAMES } from '../shared/sfx.js';
import { LOOKS } from '../stage/renderer.js';
const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const card = (t, b, cls = '') => `<section class="card ${cls}">${t ? `<header class="card-h">${t}</header>` : ''}<div class="card-b">${b}</div></section>`;
const opt = (v, cur, label) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
const seg = (path, cur, items) => `<div class="seg">${items.map(([v, l]) => `<button class="${String(v) === String(cur) ? 'on' : ''}" data-set="${path}" data-v="${esc(JSON.stringify(v))}">${l}</button>`).join('')}</div>`;

export function directorView(V, ui) {
  const ph = ui.dirPhase || V.phase; const T = TIMELINE[ph] || {}; const checks = ui.checks || {};
  return `<div class="view-head"><h2>سناریو و کارگردانی</h2><div class="seg wrap">${PHASES.map(p => `<button class="${p.id === ph ? 'on' : ''} ${p.id === V.phase ? 'live' : ''}" data-dir="${p.id}">${esc(p.fa)}</button>`).join('')}</div></div>
  <div class="cols2">
    ${card(`${esc(PHASES.find(p => p.id === ph).fa)} <span class="mono dim">${esc(T.time || '')}</span>`, `<p class="lead">${esc(T.goal || '')}</p><p class="rule">${esc(T.rule || '')}</p>${T.safety ? `<div class="safety">${esc(T.safety)}</div>` : ''}`)}
    ${card('وسایل و آماده‌سازی', `<ul class="check">${(PROPS[ph] || []).map((x, i) => `<li><label><input type="checkbox" data-check="${ph}-${i}" ${checks[ph + '-' + i] ? 'checked' : ''}> ${esc(x)}</label></li>`).join('') || '<li class="dim">—</li>'}</ul>`)}
  </div>
  ${card('شات‌کارت‌ها', `<div class="shots">${(SHOTS[ph] || []).map(s => `<article class="shot"><b class="mono">${esc(s[0])}</b><span class="mono dim">${esc(s[1])}</span><em>${esc(s[2])}</em><p>${esc(s[3])}</p><small>▸ ${esc(s[4])}</small></article>`).join('')}</div>`)}
  <div class="cols2">${card('جمله‌های جمنای', `<div class="lines-list">${(GEMINI[ph] || []).map(t => `<div class="gl"><span>${esc(t)}</span>${B('بگو', { type: 'SAY', speaker: 'G', text: t }, 'sm G')}</div>`).join('')}</div>`)}
  ${card('ایمنی و قوانین طلایی', `<ul class="list">${SAFETY.map(x => `<li>${esc(x)}</li>`).join('')}<li>هیچ عددی از دهان جمنای بیرون نمی‌آید مگر کارگردان از اپ خوانده باشد.</li><li>مرجع: ۱ قانون اعلام‌شده · ۲ تروث‌کم · ۳ لاگ اپ · ۴ جمنای</li></ul><div class="row">${B('برگهٔ مادر V7 (چاپ)', { local: 'print' }, 'ghost')}</div>`)}</div>`;
}
export function studioView(V) {
  const st = V.settings; const chroma = st.chroma;
  return `<div class="view-head"><h2>استودیو · خروجی تصویر</h2><div class="row">${B('باز کردن پنجرهٔ خروجی', { local: 'openStage' }, 'gold')}${B('خروجی کروما', { local: 'openStage', chroma: 1 }, 'ghost')}</div></div>
  <div class="studio"><div class="preview-slot big" id="slot-studio"></div>
  <div class="stack">
    ${card('تم', seg('theme', st.theme, [['vault', 'Vault · سینمایی'], ['beast', 'Beast Arena · شو']]) + `<p class="hint">Beast Arena با الهام از زبان تصویری مسابقه‌های بزرگ تلویزیونی: رنگ اشباع، تایپ درشت با خط دور ضخیم، کاشی‌های برچسبی.</p>`)}
    ${card('لوک سینمایی', seg('look', st.look, Object.keys(LOOKS).map(k => [k, { cinema: 'Cinema', arena: 'Arena', broadcast: 'Broadcast', noir: 'Noir', studio3d: 'Studio 3D' }[k]])))}
    ${card('کروما برای CapCut', `${seg('chroma', chroma, [['off', 'خاموش'], ['on', 'روشن']])}<div class="row">${seg('chromaColor', st.chromaColor, [['auto', 'خودکار'], ['blue', 'آبی'], ['green', 'سبز'], ['magenta', 'مَجنتا']])}</div><p class="hint">«خودکار» آبی را انتخاب می‌کند چون رنگ عماد سبز است (تداخل کلید). گرافیک روی رنگ کلید دقیق و بدون گرین می‌ماند.</p>`)}
    ${card('سرعت انیمیشن‌ها', `<input type="range" min="0.25" max="2" step="0.25" value="${st.fxSpeed}" data-range="fxSpeed"><span class="mono">${st.fxSpeed}x</span><p class="hint">فقط گرافیک کند/تند می‌شود؛ ساعت بازی همیشه واقعی است.</p>`)}
    ${card('تدوین', `<label class="sw"><input type="checkbox" data-toggle="ghost" ${st.ghost ? 'checked' : ''}> شبح دویدن اول در دویدن دوم (فقط خروجی تدوین، نه جلوی بازیکن)</label>`)}
  </div></div>
  ${card('نکته‌های ضبط', `<ul class="list"><li>پنجرهٔ خروجی را در OBS به‌صورت Window/Browser Capture بگیرید (1920×1080، 50fps).</li><li>در همان پنجره: کلید <kbd>R</kbd> ضبط WebM/MP4، <kbd>D</kbd> ضبط دوگانه (کروما + تمام‌صفحه)، <kbd>F</kbd> تمام‌صفحه.</li><li>آدرس برای OBS Browser Source: <code class="mono" data-copy="stageurl">${esc(location.origin + location.pathname.replace(/index\.html$/, '') + 'stage.html')}</code></li></ul>`)}`;
}
export function subsView(V) {
  const s = V.settings.subs;
  return `<div class="view-head"><h2>زیرنویس · کاملاً قابل‌کنترل</h2><div class="row">${B(s.on ? 'زیرنویس روشن' : 'زیرنویس خاموش', { type: 'SET', path: 'subs.on', value: !s.on }, s.on ? 'gold' : 'ghost', { key: 'C' })}</div></div>
  <div class="studio"><div class="preview-slot big" id="slot-subs"></div><div class="stack">
  ${card('پریست', seg('subs.preset', s.preset, [['main', 'ویدیو اصلی'], ['shorts', 'شورتس ۹:۱۶'], ['rehearsal', 'تمرین'], ['off', 'خاموش']]))}
  ${card('گوینده‌ها', ['G', 'E', 'M', 'A'].map(k => `<label class="sw"><input type="checkbox" data-toggle="subs.speakers.${k}" ${s.speakers[k] ? 'checked' : ''}> ${({ G: 'جمنای', E: esc(V.names.E), M: esc(V.names.M), A: 'اپ / بنر' })[k]}</label>`).join(''))}
  ${card('حالت نمایش و افکت WebGL', seg('subs.mode', s.mode, [['all', 'یکجا'], ['word', 'کلمه‌به‌کلمه'], ['type', 'تایپ‌رایتر'], ['karaoke', 'کارائوکه']]) + `<div class="row">${seg('subs.fx', s.fx, [['none', 'بدون'], ['shine', 'درخشش'], ['glitch', 'گلیچ ورود'], ['wave', 'موج']])}</div>`)}
  ${card('سرعت و زمان', `<label>سرعت نمایش <span class="mono">${fa(s.cps)} نویسه/ثانیه</span><input type="range" min="8" max="25" step="1" value="${s.cps}" data-range="subs.cps"></label>
    <label>تأخیر <span class="mono">${s.offset > 0 ? '+' : ''}${s.offset.toFixed(1)} ث</span><input type="range" min="-2" max="2" step="0.1" value="${s.offset}" data-range="subs.offset"></label><p class="hint">مدت هر زیرنویس = بیشترینِ (۱٫۵ ثانیه، طول متن ÷ سرعت)، سقف ۷ ثانیه.</p>`)}
  ${card('ظاهر', `<label>اندازه <span class="mono">${s.size}px</span><input type="range" min="24" max="96" step="2" value="${s.size}" data-range="subs.size"></label>
    ${seg('subs.pos', s.pos, [['bottom', 'پایین'], ['top', 'بالا'], ['custom', 'سفارشی']])}${s.pos === 'custom' ? `<label>ارتفاع<input type="range" min="0.25" max="0.9" step="0.01" value="${s.y}" data-range="subs.y"></label>` : ''}
    <div class="row">${seg('subs.lines', s.lines, [[1, '۱ خط'], [2, '۲ خط']])}${seg('subs.bg', s.bg, [['none', 'بدون'], ['shadow', 'سایه'], ['box', 'جعبه']])}</div>${s.bg === 'box' ? `<label>شفافیت جعبه<input type="range" min="0" max="1" step="0.05" value="${s.bgOpacity}" data-range="subs.bgOpacity"></label>` : ''}`)}
  ${card('ضبط تمیز و خروجی', `<label class="sw"><input type="checkbox" data-toggle="subs.clean" ${s.clean ? 'checked' : ''}> ضبط تمیز: زیرنویس فقط در لاگ ثبت شود (برای SRT)</label><div class="row">${B('SRT فارسی', { local: 'srt' }, 'ghost')}${B('WebVTT', { local: 'vtt' }, 'ghost')}${B('SRT انگلیسی خالی', { local: 'srt-en' }, 'ghost')}</div>
    <div class="row"><input id="sub-test" class="inp" value="عماد، پونزده ثانیه. الیاس... ساندویچ ازت برد." >${B('نمایش آزمایشی', { local: 'subTest' }, 'ghost')}</div>`)}
  </div></div>`;
}
export function voiceView(V, ui) {
  const recs = ui.voiceKeys || new Set(); const all = Object.entries(GEMINI).flatMap(([ph, ls]) => ls.map(t => [ph, t]));
  return `<div class="view-head"><h2>صدا و گوینده</h2><p class="dim">صدای ضبط‌شده بر TTS مرورگر اولویت دارد. هر جمله را می‌توانی ضبط یا فایل آن را وارد کنی.</p></div>
  <div class="cols2">${card('جمله‌های جمنای (با اعراب حداقلی)', `<div class="lines-list tall">${all.map(([ph, t]) => `<div class="gl"><small class="dim">${esc(PHASES.find(p => p.id === ph)?.fa || 'همه‌جا')}</small><span>${esc(t)}</span><div class="row tight">${B('▶', { local: 'play', text: t }, 'sm ghost')}${B(ui.recording === t ? '■' : '●', { local: 'rec', text: t }, 'sm ' + (ui.recording === t ? 'danger' : 'ghost'))}${B('فایل', { local: 'importVoice', text: t }, 'sm ghost')}${recs.has('v:' + t.replace(/[\u064B-\u0652\u0670]/g, '').replace(/\s+/g, ' ').trim()) ? '<span class="tag gold">ضبط</span>' : ''}</div></div>`).join('')}</div>`)}
  ${card('افکت‌های صوتی (SFX)', `<p class="hint">همه ساخته‌شده با WebAudio و بدون کپی‌رایت. برای ترندها فایل مجاز خودت (Artlist / Epidemic / YouTube Audio Library) را جایگزین کن.</p><div class="sfx">${SFX_NAMES.filter(n => n !== 'beep1k').map(n => `<div class="sx"><b class="mono">${n}</b>${B('▶', { local: 'sfx', name: n }, 'sm ghost')}${B('جایگزین', { local: 'importSfx', name: n }, 'sm ghost')}${(ui.sfxKeys || []).includes(n) ? B('حذف', { local: 'delSfx', name: n }, 'sm danger') : ''}</div>`).join('')}</div>
   <label>صدای کلی<input type="range" min="0" max="1" step="0.05" value="${V.settings.volume}" data-range="volume"></label>${seg('sfxWhere', V.settings.sfxWhere, [['control', 'پخش از کنترل'], ['stage', 'پخش از خروجی'], ['both', 'هر دو']])}<label class="sw"><input type="checkbox" data-toggle="sfx" ${V.settings.sfx ? 'checked' : ''}> افکت‌ها فعال</label>`)}</div>`;
}
export function dataView(V) {
  return `<div class="view-head"><h2>قسمت و داده‌ها</h2></div>
  <div class="cols2">${card('بازیکن‌ها', `<div class="row"><label>بازیکن قرمز (چپ)<input class="inp" data-name="E" value="${esc(V.names.E)}"></label><label>بازیکن سبز (راست)<input class="inp" data-name="M" value="${esc(V.names.M)}"></label></div>`)}
  ${card('رمز واقعی کیف طلایی', `${V.vault.seal ? `<div class="ok">کد مهر: <b class="mono">${esc(V.vault.seal)}</b> · رمز جز در CASE نمایش داده نمی‌شود</div>` : '<div class="warn">هنوز مهر نشده</div>'}<p class="hint">رمز را نفر سوم (نه الیاس) روی قفل تنظیم کند و همین‌جا وارد کند. C1 = رقم اول (پاداش نقاشی) · C2 = رقم دوم (پاداش حافظه) · C3 = جواب معما.</p><div class="row"><input id="code-in" class="inp mono" type="password" inputmode="numeric" maxlength="3" placeholder="•••">${B('مهر کن', { local: 'seal' }, 'gold')}</div>`)}</div>
  ${card('بانک معمای خنده‌دار · ۰ تا ۹', `<p class="hint">اپ معما را از دستهٔ رقم سوم برمی‌دارد. برای حفظ راز، متن فقط با نگه‌داشتن دکمه دیده می‌شود.</p><details><summary>نمایش (فقط نفر سوم)</summary><table class="tbl"><tr><th>جواب</th><th>عادی</th><th>تند</th><th>ذره‌بین</th></tr>${RIDDLES.map(r => `<tr><td class="mono">${r.a}</td><td>${esc(r.n)}</td><td>${esc(r.s)}</td><td>${esc(r.h)}</td></tr>`).join('')}</table></details>`)}
  <div class="cols2">${card('نقاشی کور · ۱۶ هدف', `<div class="chips">${TARGETS.map(t => `<span class="chip ${t.v7 ? 'gold' : ''}">${esc(t.fa)}</span>`).join('')}</div>`)}
  ${card('پاکت‌های سرنوشت · ۱۲', `<ol class="list">${FATE.map(f => `<li><b>${esc(f.t)}</b> · ${esc(f.d)}</li>`).join('')}</ol>`)}</div>
  ${card('اعداد مقدس (۱٫۳)', `<p class="mono">شروع ۴۵ · R3 کف ۳ سقف ۲۰ · R4 ۱۵ (۱۰/۵، −۵) · سقف فاصله ۳۰ · کارت ۱۰/۵/۱۵/۱۰/۲۰ · مالیات ۵ · کف ۲۰ · حافظه ۵/۸/−۳ · معما قفل ۵ · کد ۳ ثانیه</p>`)}`;
}
export function logView(V, ui) {
  return `<div class="view-head"><h2>لاگ و حافظه</h2><div class="row">${B('CSV', { local: 'csv' }, 'ghost')}${B('SRT', { local: 'srt' }, 'ghost')}${B('پشتیبان JSON', { local: 'backup' }, 'gold')}${B('بازیابی', { local: 'restore' }, 'ghost')}${B('UNDO آخرین رویداد', { type: 'UNDO' }, 'ghost', { key: 'U' })}${B('شروع قسمت تازه', { local: 'reset' }, 'danger', { confirm: 'همه‌چیز پاک شود؟ (پشتیبان بگیر)' })}</div></div>
  <div class="cols2">${card('نسخه‌ها (۲۵ تای آخر)', `<ul class="list">${(ui.versions || []).slice().reverse().map(v => `<li><span class="mono">${new Date(v.at).toLocaleTimeString('fa-IR')}</span> · ${esc(v.label)} ${B('بازگردانی', { local: 'restoreVer', at: v.at }, 'sm ghost', { confirm: 'این نسخه بازگردانی شود؟' })}</li>`).join('') || '<li class="dim">هنوز نسخه‌ای ذخیره نشده</li>'}</ul>`)}
  ${card('اصلاح دستی (با دلیل)', `<div class="row"><select id="ed-p" class="inp"><option value="E">${esc(V.names.E)}</option><option value="M">${esc(V.names.M)}</option></select><input id="ed-d" class="inp mono" type="number" step="0.1" placeholder="±ثانیه"><input id="ed-r" class="inp" placeholder="دلیل (از تروث‌کم)"></div><div class="row">${B('ثبت EDIT', { local: 'edit' }, 'gold')}</div>`)}</div>
  ${card('لاگ غیرقابل‌حذف', `<div class="logtbl mono">${V.log.slice().reverse().map(l => `<div><span>${esc(l.t)}</span><b>${esc(l.text)}</b><i>${esc(l.src)}</i></div>`).join('')}</div>`)}`;
}
export function phonesView(V, ui) {
  const L = V.settings.link; const info = ui.info; const base = info && info.ips && info.ips.length ? `http://${info.ips[0]}:${info.port}` : location.origin;
  const roles = [['DIRECTOR', 'کارگردان'], ['PLAYER_E', 'بازیکن ' + V.names.E], ['PLAYER_M', 'بازیکن ' + V.names.M], ['JUDGE', 'داور سوم'], ['MONITOR', 'مانیتور']];
  return `<div class="view-head"><h2>گوشی‌ها · کنترل همزمان</h2><p class="dim">${location.protocol === 'file:' ? 'برای حالت گوشی اپ را با serve.mjs اجرا کن (راهنما در README).' : info ? 'شبکهٔ محلی آماده است · بدون اینترنت' : 'سرور WebSocket پیدا نشد؛ serve.mjs را اجرا کن.'}</p></div>
  <div class="phones">${roles.map(([r, l]) => { const url = `${base}/remote.html?room=${L.room}&pin=${L.pin}&role=${r}`; return card(esc(l), `<div class="qr" data-qr="${esc(url)}"></div><code class="mono small">${esc(url)}</code>`); }).join('')}</div>
  ${card('اتصال‌ها', `<p>اتاق <b class="mono">${esc(L.room)}</b> · PIN <b class="mono">${esc(L.pin)}</b> · ${ui.ws ? 'WebSocket وصل' : 'فقط همین دستگاه'}</p><ul class="list">${(ui.peers || []).map(p => `<li>${esc(p.role)} <span class="dim mono">${esc(p.id)}</span></li>`).join('') || '<li class="dim">هنوز گوشی‌ای وصل نشده</li>'}</ul>${B('PIN تازه', { local: 'newPin' }, 'ghost')}`)}`;
}
export function settingsView(V) {
  return `<div class="view-head"><h2>تنظیمات و میان‌برها</h2></div><div class="cols2">
  ${card('قوانین اپ', `<label class="sw"><input type="checkbox" data-toggle="silenceRule" ${V.settings.silenceRule ? 'checked' : ''}> قانون سکوت: وقتی دهان پر است جملهٔ جمنای مسدود شود</label>`)}
  ${card('کلیدهای کیبورد عددی', `<table class="tbl mono"><tr><td>7 / 9</td><td>R3 دهان‌پر E / M</td></tr><tr><td>1 / 3</td><td>R3 دهان خالی ✔ E / M</td></tr><tr><td>4 / 6</td><td>R3 جریمهٔ ۳ ثانیه E / M</td></tr><tr><td>1 / 2</td><td>R1 برد · R2 گُل · R4 تمام (E / M)</td></tr><tr><td>0</td><td>R4 غلط (آخرین تمام)</td></tr><tr><td>*</td><td>R4 چالش چسب</td></tr><tr><td>Enter</td><td>تأیید / رونمایی</td></tr><tr><td>Space</td><td>شروع/توقف</td></tr><tr><td>T · G · S · U · P</td><td>جملهٔ بعدی جمنای · کروما · SYNC · UNDO · مکث</td></tr><tr><td>C · [ ] · - =</td><td>زیرنویس · سرعت · اندازه</td></tr><tr><td>F2</td><td>QR گوشی</td></tr></table>`)}</div>`;
}
export { PRESETS };
