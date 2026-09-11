/* =====================================================
   MJ ADMIN V12 - API PROVIDER
   Carrega uma implementação de API sem alterar main.js.
   ===================================================== */
(() => {
  const cfg = window.MJ_CONFIG || {};
  const provider = String(cfg.provider || 'sheets').toLowerCase();

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Não foi possível carregar o provedor: ' + src));
      document.head.appendChild(script);
    });
  }

  window.MJProvider = {
    name: provider,
    ready: (async () => {
      if (provider === 'supabase') {
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
        await loadScript('js/api-supabase.js?v=12.0.2');
      } else {
        // Mantém o api.js atual exatamente como está.
        await loadScript('js/api.js?v=11.27.2');
      }

      if (!window.MJCloud) {
        throw new Error('O provedor de dados não inicializou corretamente.');
      }

      return window.MJCloud;
    })()
  };
})();
