/* =====================================================
   MJ ADMIN V11.12 - GOOGLE SHEETS + APPS SCRIPT
   Google Sheets = fonte principal.
   localStorage = cache local.
   A carga inicial SEMPRE busca a planilha antes do main.js.
   ===================================================== */
(() => {
  const CONFIG_KEY = 'mj_google_api_config';
  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbzOphqSI6ydsJ_OK2h2cgcR2Hf1Cs52ddNAbccwcQP4B-c_OLNUtZEzMWxV78sWbXxmxg/exec';
  const DATA_KEYS = [
    'mj_products','mj_clients','mj_quotes','mj_sales',
    'mj_financial_transactions','mj_expenses',
    'mj_infinitepay_config','mj_infinitepay_transactions'
  ];

  let hydrated = false;
  let syncingBootstrap = false;

  function getConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null') || { enabled: true, url: DEFAULT_API_URL };
    } catch (_) {
      return { enabled: true, url: DEFAULT_API_URL };
    }
  }

  function normalizeUrl(url) { return String(url || '').trim(); }

  async function request(action, payload = {}, timeoutMs = 20000) {
    const cfg = getConfig();
    const url = normalizeUrl(cfg.url);
    if (!url) throw new Error('URL do Apps Script não configurada.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, ...payload }),
        redirect: 'follow',
        signal: controller.signal
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch (_) { throw new Error('O Apps Script retornou uma resposta inválida. Verifique o deploy.'); }
      if (!json.ok) throw new Error(json.message || 'Falha na API do Apps Script.');
      return json;
    } catch (err) {
      if (err?.name === 'AbortError') throw new Error('Tempo esgotado ao conectar com o Apps Script.');
      throw err;
    } finally { clearTimeout(timer); }
  }

  function setStatus(state, text) {
    const pill = document.getElementById('cloudConfigStatus');
    const sw = document.getElementById('cloudSwitch');
    if (pill) {
      pill.textContent = text;
      pill.classList.toggle('off', state !== 'ok');
      pill.classList.toggle('on', state === 'ok');
    }
    if (sw) sw.classList.toggle('on', state === 'ok');
  }

  function setInfo(text, error = false) {
    const el = document.getElementById('cloudSyncInfo');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('cloud-error', !!error);
  }

  async function bootstrap() {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.url) {
      hydrated = true;
      setStatus('off', 'Desativado');
      setInfo('Banco em nuvem desativado. Usando cache local.');
      return { connected: false };
    }
    if (syncingBootstrap) return { connected: false };

    syncingBootstrap = true;
    setStatus('loading', 'Conectando...');
    setInfo('Carregando dados da planilha...');
    window.MJAppLoader?.set?.('loading','Conectando ao Google Sheets...',18);
    try {
      const res = await request('bootstrap');
      window.MJAppLoader?.set?.('loading','Recebendo produtos, clientes e vendas...',52);
      const remote = res.data || {};

      // A planilha vence o cache. Não envia nada durante esta fase.
      for (const key of DATA_KEYS) {
        if (!(key in remote)) continue;
        const fallback = key.includes('config') ? {} : [];
        localStorage.setItem(key, JSON.stringify(remote[key] ?? fallback));
      }

      hydrated = true;
      window.MJAppLoader?.set?.('loading','Sincronização concluída. Preparando interface...',76);
      setStatus('ok', 'Conectado');
      setInfo(`Planilha conectada • ${res.spreadsheetName || 'Banco MJ'} • ${new Date().toLocaleString('pt-BR')}`);
      return { connected: true, response: res };
    } catch (err) {
      hydrated = true;
      setStatus('error', 'Sem conexão');
      setInfo(`Não foi possível carregar a planilha. Usando cache local. ${err.message}`, true);
      console.error('[MJ Cloud] Bootstrap:', err);
      return { connected: false, error: err };
    } finally {
      syncingBootstrap = false;
    }
  }

  async function syncKey(key, data) {
    const cfg = getConfig();
    if (!hydrated || syncingBootstrap || !cfg.enabled || !cfg.url) return { skipped: true };
    if (!DATA_KEYS.includes(key)) throw new Error('Chave de dados não suportada: ' + key);
    try {
      setInfo('Sincronizando alterações com a planilha...');
      const result = await request('syncKey', { key, data });
      setStatus('ok', 'Conectado');
      setInfo(`Última sincronização: ${new Date().toLocaleString('pt-BR')}`);
      return result;
    } catch (err) {
      setStatus('error', 'Sem conexão');
      setInfo(`Falha ao sincronizar: ${err.message}`, true);
      console.error('[MJ Cloud] Falha ao sincronizar', key, err);
      throw err;
    }
  }

  async function syncAll() {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.url) throw new Error('Ative e configure o banco em nuvem.');
    const data = {};
    for (const key of DATA_KEYS) {
      try { data[key] = JSON.parse(localStorage.getItem(key) || 'null'); }
      catch (_) { data[key] = null; }
    }
    setInfo('Enviando os dados para a planilha...');
    const res = await request('syncAll', { data }, 40000);
    setStatus('ok', 'Conectado');
    setInfo(`Sincronização concluída: ${new Date().toLocaleString('pt-BR')}`);
    return res;
  }

  function bindSettings() {
    const cfg = getConfig();
    const url = document.getElementById('cloudApiUrl');
    const enabled = document.getElementById('cloudEnabled');
    if (url) url.value = cfg.url || '';
    if (enabled) enabled.value = String(cfg.enabled !== false);

    document.getElementById('saveGoogleApiBtn')?.addEventListener('click', async () => {
      const next = {
        url: normalizeUrl(document.getElementById('cloudApiUrl')?.value),
        enabled: document.getElementById('cloudEnabled')?.value === 'true'
      };
      if (next.enabled && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(next.url)) {
        window.toast?.('Informe a URL /exec publicada pelo Apps Script.');
        return;
      }
      localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
      window.toast?.('Configuração do banco salva.');
      if (next.enabled) {
        await bootstrap();
        location.reload();
      } else {
        setStatus('off', 'Desativado');
        setInfo('Banco em nuvem desativado. O sistema está usando apenas o cache local.');
      }
    });

    document.getElementById('testGoogleApiBtn')?.addEventListener('click', async () => {
      const temp = {
        url: normalizeUrl(document.getElementById('cloudApiUrl')?.value),
        enabled: document.getElementById('cloudEnabled')?.value === 'true'
      };
      if (!temp.url) return window.toast?.('Informe a URL do Apps Script.');
      localStorage.setItem(CONFIG_KEY, JSON.stringify(temp));
      setStatus('loading', 'Testando...');
      try {
        const res = await request('ping');
        setStatus('ok', 'Conectado');
        setInfo(`Conexão validada com “${res.spreadsheetName || 'Banco MJ'}”.`);
        window.toast?.('Conexão com a planilha validada.');
      } catch (err) {
        setStatus('error', 'Falha');
        setInfo(err.message, true);
        window.toast?.('Não foi possível conectar ao Apps Script.');
      }
    });

    document.getElementById('syncGoogleApiBtn')?.addEventListener('click', async () => {
      try {
        await syncAll();
        window.toast?.('Dados enviados para a planilha.');
      } catch (err) {
        setStatus('error', 'Falha');
        setInfo(err.message, true);
        window.toast?.(err.message);
      }
    });
  }

  async function init() {
    bindSettings();
    return bootstrap();
  }

  window.MJCloud = {
    init, request, bootstrap, syncAll,
    pushKey: syncKey,
    getConfig, DATA_KEYS,
    saveQuote: orcamento => request('salvarOrcamento', { orcamento }),
    deleteQuote: id => request('excluirOrcamento', { id }),
    convertQuote: (id, saleId='') => request('converterOrcamento', { id, saleId }),
    finalizeSale: venda => request('finalizarVenda', { venda }, 30000),
    cancelSale: id => request('cancelarVenda', { id }, 30000),
    saveFinancial: lancamento => request('salvarFinanceiro', { lancamento }),
    markFinancialPaid: id => request('marcarFinanceiroPago', { id }),
    saveExpense: despesa => request('salvarDespesa', { despesa }),
    deleteExpense: id => request('excluirDespesa', { id }),
    markExpensePaid: id => request('marcarDespesaPaga', { id })
  };
})();
