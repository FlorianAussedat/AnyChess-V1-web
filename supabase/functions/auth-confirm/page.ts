import { CONFIRM_COPY, INTERPRET_SOURCE } from './outcome.ts';

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderConfirmationPage(config: {
  supabaseUrl: string;
  anonKey: string;
  logoUrl?: string;
  verifyUrl?: string;
}): string {
  const cfg = jsonForScript({
    url: config.supabaseUrl,
    anon: config.anonKey,
    verify: config.verifyUrl ?? '',
  });
  const logo = htmlAttr(config.logoUrl || '/brand/anychess-logo.png');
  const copy = jsonForScript(CONFIRM_COPY);
  const open = appOpenFallback();
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <meta name="robots" content="noindex">
  <title>AnyChess</title>
  <style>
    html { overflow-x: hidden; }
    body {
      margin: 0;
      background: #0B1728;
      color: #DCE8F5;
      font-family: Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 18px;
      line-height: 1.5;
      overflow-x: hidden;
    }
    main { max-width: 28rem; margin: 0 auto; padding: 28px 16px 40px; box-sizing: border-box; }
    .card {
      background: #102040;
      border: 1px solid #1C3558;
      border-radius: 20px;
      padding: 28px 20px;
      box-sizing: border-box;
    }
    .logo { display: block; width: min(100%, 280px); height: auto; margin: 0 auto 20px; }
    h1 { margin: 0 0 12px; font-size: 26px; line-height: 1.25; font-weight: 700; }
    p { margin: 0; font-size: 18px; line-height: 1.5; overflow-wrap: anywhere; }
    .alt { margin-top: 16px; color: #8FB0CC; font-size: 16px; }
    form[hidden], #open[hidden] { display: none; }
    label { display: block; margin: 16px 0 6px; font-size: 16px; }
    input {
      width: 100%;
      box-sizing: border-box;
      padding: 14px;
      border-radius: 12px;
      border: 1px solid #1C3558;
      background: #0B1728;
      color: #DCE8F5;
      font-size: 18px;
    }
    button, a.open {
      display: block;
      box-sizing: border-box;
      width: 100%;
      margin-top: 20px;
      min-height: 48px;
      padding: 14px 16px;
      border: 0;
      border-radius: 12px;
      background: #F5A623;
      color: #0B1728;
      font-weight: 700;
      font-size: 18px;
      line-height: 1.2;
      text-align: center;
      text-decoration: none;
    }
    a.open:focus-visible, button:focus-visible { outline: 3px solid #DCE8F5; outline-offset: 3px; }
    #recover-error { margin-top: 12px; }
    noscript p { margin: 16px; }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <img class="logo" src="${logo}" alt="AnyChess" width="280" height="97" />
      <h1 id="title">AnyChess</h1>
      <p id="message">${CONFIRM_COPY.fr.checking}</p>
      <a id="open" class="open" href="${open}">${CONFIRM_COPY.fr.open}</a>
      <p id="alt" class="alt">${CONFIRM_COPY.fr.alt}</p>
      <form id="recover" hidden="hidden">
        <label id="label-password" for="password">${CONFIRM_COPY.fr.recoverLabel}</label>
        <input id="password" name="password" type="password" autocomplete="new-password" minlength="6" />
        <label id="label-password2" for="password2">${CONFIRM_COPY.fr.recoverLabel2}</label>
        <input id="password2" name="password2" type="password" autocomplete="new-password" minlength="6" />
        <button id="recover-submit" type="submit">${CONFIRM_COPY.fr.recoverSubmit}</button>
        <p id="recover-error"></p>
      </form>
    </div>
  </main>
  <noscript><p>${CONFIRM_COPY.fr.idle} ${CONFIRM_COPY.en.idle}</p></noscript>
  <script>
${INTERPRET_SOURCE}
(function () {
  var cfg = ${cfg};
  var copy = ${copy};
  var title = document.getElementById('title');
  var message = document.getElementById('message');
  var open = document.getElementById('open');
  var alt = document.getElementById('alt');
  var lang = pageLanguage(location.search, navigator.language || '');
  var client = pageClient(location.search);
  var text = copy[lang] || copy.fr;
  document.documentElement.lang = lang;
  if (open) open.href = appOpenHref(client, navigator.userAgent || '');
  if (open) open.textContent = text.open;
  if (alt) alt.textContent = text.alt;
  function show(key, headingKey) {
    title.textContent = text[headingKey || (key + 'Title')] || text.checkingTitle;
    message.textContent = text[key] || '';
    document.title = title.textContent;
  }
  function tokenFromLocation() {
    var query = new URLSearchParams(location.search.charAt(0) === '?' ? location.search.slice(1) : location.search);
    var rawHash = location.hash.charAt(0) === '#' ? location.hash.slice(1) : location.hash;
    var fragment = new URLSearchParams(rawHash);
    return query.get('access_token') || fragment.get('access_token') || '';
  }
  function readAuth(response) {
    return response.json().then(function (body) {
      var status = response.status;
      var ok = response.ok;
      var confirmed = false;
      var payload = body;
      if (body && typeof body === 'object' && body.proxy === true) {
        if (typeof body.status === 'number') status = body.status;
        if (typeof body.ok === 'boolean') ok = body.ok;
        confirmed = body.confirmed === true;
        payload = body.body || null;
      }
      return { ok: ok, status: status, body: payload, confirmed: confirmed };
    }, function () {
      return { ok: false, status: response.status, body: null, confirmed: false };
    });
  }
  function requestVerify() {
    if (cfg.anon && cfg.url) {
      return fetch(cfg.url.replace(/\\/$/, '') + '/auth/v1/user', {
        headers: { Authorization: 'Bearer ' + accessToken, apikey: cfg.anon }
      }).then(readAuth);
    }
    return fetch(cfg.verify, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', access_token: accessToken })
    }).then(readAuth);
  }
  function requestRecover(password) {
    if (cfg.anon && cfg.url) {
      return fetch(cfg.url.replace(/\\/$/, '') + '/auth/v1/user', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          apikey: cfg.anon,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: password })
      }).then(readAuth);
    }
    return fetch(cfg.verify, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'recover', access_token: accessToken, password: password })
    }).then(readAuth);
  }
  function stripTokens() {
    var keep = new URLSearchParams();
    if (client === 'dev') keep.set('client', 'dev');
    var params = new URLSearchParams(location.search.charAt(0) === '?' ? location.search.slice(1) : location.search);
    var requested = (params.get('lang') || '').toLowerCase();
    if (requested === 'fr' || requested === 'en') keep.set('lang', requested);
    var next = location.pathname + (keep.toString() ? '?' + keep.toString() : '');
    history.replaceState(null, '', next);
    if (location.hash) location.hash = '';
  }
  show('checking', 'checkingTitle');
  var outcome = interpretConfirmationLocation(location.search, location.hash);
  var accessToken = tokenFromLocation();
  if (outcome === 'expired' || outcome === 'invalid') {
    show('expired', 'expiredTitle');
    stripTokens();
    return;
  }
  if (outcome === 'unavailable') {
    show('unavailable', 'unavailableTitle');
    return;
  }
  if (outcome === 'recover') {
    var form = document.getElementById('recover');
    var password = document.getElementById('password');
    var password2 = document.getElementById('password2');
    var recoverError = document.getElementById('recover-error');
    var submit = document.getElementById('recover-submit');
    var label = document.getElementById('label-password');
    var label2 = document.getElementById('label-password2');
    if (label) label.textContent = text.recoverLabel;
    if (label2) label2.textContent = text.recoverLabel2;
    if (submit) submit.textContent = text.recoverSubmit;
    if (!accessToken || !form || !password || !password2 || !submit || !((cfg.url && cfg.anon) || cfg.verify)) {
      show('recoverFailed', 'recoverFailedTitle');
      stripTokens();
      return;
    }
    show('recoverPrompt', 'recoverTitle');
    form.hidden = false;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var next = password.value;
      var again = password2.value;
      if (next.length < 6) {
        recoverError.textContent = text.recoverShort;
        return;
      }
      if (next !== again) {
        recoverError.textContent = text.recoverMismatch;
        return;
      }
      recoverError.textContent = '';
      submit.disabled = true;
      requestRecover(next).then(function (result) {
        if (result.ok) {
          form.hidden = true;
          show('recoverSaved', 'recoverSavedTitle');
          stripTokens();
          return;
        }
        submit.disabled = false;
        if (result.status === 422) {
          recoverError.textContent = text.recoverShort;
          return;
        }
        if (result.status >= 500 || result.status === 0) {
          show('unavailable', 'unavailableTitle');
          form.hidden = true;
          return;
        }
        show('recoverFailed', 'recoverFailedTitle');
        form.hidden = true;
        stripTokens();
      }).catch(function () {
        recoverError.textContent = text.recoverNetwork;
        submit.disabled = false;
      });
    });
    return;
  }
  if (outcome === 'other') {
    show('other', 'otherTitle');
    stripTokens();
    return;
  }
  if (outcome !== 'verify') {
    show('idle', 'idleTitle');
    return;
  }
  if (!accessToken || !((cfg.url && cfg.anon) || cfg.verify)) {
    show('idle', 'idleTitle');
    return;
  }
  requestVerify().then(function (result) {
    if (result.confirmed === true || (result.ok && userEmailIsConfirmed(result.body))) {
      show('confirmed', 'confirmedTitle');
      stripTokens();
      return;
    }
    if (result.status >= 500 || result.status === 0) {
      show('unavailable', 'unavailableTitle');
      return;
    }
    show('expired', 'expiredTitle');
    stripTokens();
  }).catch(function () {
    show('unavailable', 'unavailableTitle');
  });
})();
  </script>
</body>
</html>`;
}

function htmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function appOpenFallback(): string {
  return 'intent://open#Intent;scheme=anychess;package=com.anychess.standalone;end';
}
