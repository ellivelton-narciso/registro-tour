(function () {
  const FALLBACK_URL = 'http://localhost:3000';

  let urlBE = FALLBACK_URL;

  try {
    const script = document.currentScript;
    if (!script?.src) throw new Error('script não encontrado');

    const envUrl = new URL('.env', script.src).href;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', envUrl, false);
    xhr.send(null);

    if (xhr.status >= 200 && xhr.status < 300 && xhr.responseText) {
      for (const line of xhr.responseText.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const [key, ...rest] = trimmed.split('=');
        if (key?.trim() === 'urlBE') {
          urlBE = rest.join('=').trim().replace(/^["']|["']$/g, '');
          break;
        }
      }
    }
  } catch (_) {
    // sem .env: usa fallback
  }

  localStorage.urlBE = urlBE;
})();
