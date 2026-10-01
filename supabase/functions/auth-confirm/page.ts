import { CONFIRM_COPY, INTERPRET_SOURCE } from './outcome.ts';

function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderConfirmationPage(config: { supabaseUrl: string; anonKey: string }): string {
  const cfg = jsonForScript({ url: config.supabaseUrl, anon: config.anonKey });
  const copy = jsonForScript(CONFIRM_COPY);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>AnyChess</title>
  <style>
    body { margin: 0; background: #0B1728; color: #DCE8F5; font-family: Arial, sans-serif; }
    main { max-width: 32rem; margin: 0 auto; padding: 2.5rem 1.25rem; }
    .card { background: #102040; border: 1px solid #1C3558; border-radius: 20px; padding: 1.75rem 1.25rem; }
    .brand { margin: 0 0 0.75rem; color: #F5A623; letter-spacing: 0.08em; font-size: 0.8rem; }
    h1 { margin: 0 0 0.75rem; font-size: 1.35rem; line-height: 1.3; }
    p { margin: 0; font-size: 1rem; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <div class="card">
      <p class="brand">ANYCHESS</p>
      <h1 id="title">AnyChess</h1>
      <p id="message">${CONFIRM_COPY.checking}</p>
    </div>
  </main>
  <noscript><p>${CONFIRM_COPY.idle}</p></noscript>
  <script>
${INTERPRET_SOURCE}
(function () {
  var cfg = ${cfg};
  var copy = ${copy};
  var title = document.getElementById('title');
  var message = document.getElementById('message');
  function show(text) {
    title.textContent = 'AnyChess';
    message.textContent = text;
  }
  function tokenFromLocation() {
    var query = new URLSearchParams(location.search.charAt(0) === '?' ? location.search.slice(1) : location.search);
    var rawHash = location.hash.charAt(0) === '#' ? location.hash.slice(1) : location.hash;
    var fragment = new URLSearchParams(rawHash);
    return query.get('access_token') || fragment.get('access_token') || '';
  }
  var outcome = interpretConfirmationLocation(location.search, location.hash);
  if (outcome === 'expired' || outcome === 'invalid') {
    show(copy.expired);
    return;
  }
  if (outcome === 'other') {
    show(copy.other);
    return;
  }
  if (outcome !== 'verify') {
    show(copy.idle);
    return;
  }
  var accessToken = tokenFromLocation();
  if (!cfg.url || !cfg.anon || !accessToken) {
    show(copy.idle);
    return;
  }
  fetch(cfg.url.replace(/\\/$/, '') + '/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + accessToken, apikey: cfg.anon }
  }).then(function (response) {
    return response.json().then(function (body) {
      return { ok: response.ok, body: body };
    });
  }).then(function (result) {
    if (result.ok && userEmailIsConfirmed(result.body)) {
      show(copy.confirmed);
      history.replaceState(null, '', location.pathname);
      return;
    }
    show(copy.expired);
  }).catch(function () {
    show(copy.network);
  });
})();
  </script>
</body>
</html>`;
}
