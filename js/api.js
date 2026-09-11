/* =====================================================
   MJ ADMIN V11.27 - GOOGLE SHEETS + APPS SCRIPT + LOGIN
   Google Sheets = fonte principal.
   localStorage = cache local.
   sessionStorage = sessão do usuário (token de 6h no backend).
   ===================================================== */
(() => {
  const CONFIG_KEY = 'mj_google_api_config';
  const SESSION_KEY = 'mj_auth_token';
  const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbzOphqSI6ydsJ_OK2h2cgcR2Hf1Cs52ddNAbccwcQP4B-c_OLNUtZEzMWxV78sWbXxmxg/exec';
  const DATA_KEYS = [
    'mj_products','mj_clients','mj_suppliers','mj_quotes','mj_sales','mj_purchases',
    'mj_financial_transactions','mj_expenses','mj_infinitepay_config','mj_infinitepay_transactions'
  ];

  let hydrated = false;
  let syncingBootstrap = false;
  let currentUser = null;
  let auditCache = [];
  let loginPromise = null;

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null') || { enabled: true, url: DEFAULT_API_URL }; }
    catch (_) { return { enabled: true, url: DEFAULT_API_URL }; }
  }
  function normalizeUrl(url) { return String(url || '').trim(); }
  function getToken(){ try{return sessionStorage.getItem(SESSION_KEY)||'';}catch(_){return '';} }
  function setToken(token){ try{ token?sessionStorage.setItem(SESSION_KEY,token):sessionStorage.removeItem(SESSION_KEY); }catch(_){} }

  async function request(action, payload = {}, timeoutMs = 20000) {
    const cfg = getConfig();
    const url = normalizeUrl(cfg.url);
    if (!url) throw new Error('URL do Apps Script não configurada.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body = { action, ...payload };
      if (!['ping','login','statusConfiguracao','criarAdministradorInicial'].includes(action)) body.token = getToken();
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body), redirect: 'follow', signal: controller.signal
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); }
      catch (_) { throw new Error('O Apps Script retornou uma resposta inválida. Verifique o deploy.'); }
      if (!json.ok) {
        const err = new Error(json.message || 'Falha na API do Apps Script.');
        err.code = json.code || '';
        if (err.code === 'AUTH_REQUIRED') {
          setToken(''); currentUser = null;
          window.dispatchEvent(new CustomEvent('mj-auth-required'));
        }
        throw err;
      }
      return json;
    } catch (err) {
      if (err?.name === 'AbortError') throw new Error('Tempo esgotado ao conectar com o Apps Script.');
      throw err;
    } finally { clearTimeout(timer); }
  }

  function showLogin(message='') {
    const overlay=document.getElementById('loginOverlay');
    const normal=document.getElementById('normalLoginArea');
    const setup=document.getElementById('initialSetupArea');
    const msg=document.getElementById('loginMessage');
    if(normal) normal.hidden=false;
    if(setup) setup.hidden=true;
    if(msg){msg.textContent=message||'Entre com seu usuário para acessar o sistema.';msg.classList.toggle('error',!!message);}
    if(overlay){overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');}
    setTimeout(()=>document.getElementById('loginEmail')?.focus(),80);
  }

  function showInitialSetup(message='', isError=false){
    const overlay=document.getElementById('loginOverlay');
    const normal=document.getElementById('normalLoginArea');
    const setup=document.getElementById('initialSetupArea');
    const msg=document.getElementById('initialSetupMessage');
    if(normal) normal.hidden=true;
    if(setup) setup.hidden=false;
    if(msg){msg.textContent=message||'Crie o primeiro administrador do MJ Admin.';msg.classList.toggle('error',!!isError);}
    if(overlay){overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');}
    setTimeout(()=>document.getElementById('initialAdminName')?.focus(),80);
  }

  function hideLogin(){
    const overlay=document.getElementById('loginOverlay');
    if(overlay){overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');}
  }

  function clearLoginFields(){
    const form=document.getElementById('loginForm');
    try{form?.reset();}catch(_){}
    const email=document.getElementById('loginEmail');
    const password=document.getElementById('loginPassword');
    if(email) email.value='';
    if(password) password.value='';
    // Alguns navegadores tentam restaurar o preenchimento logo após o DOM mudar.
    setTimeout(()=>{
      if(email) email.value='';
      if(password) password.value='';
    },60);
  }

  function waitForLogin(message='') {
    showLogin(message);
    if (loginPromise) return loginPromise;
    loginPromise = new Promise(resolve => {
      const form=document.getElementById('loginForm');
      const btn=document.getElementById('loginBtn');
      const handler=async(e)=>{
        e.preventDefault();
        const email=document.getElementById('loginEmail')?.value.trim()||'';
        const password=document.getElementById('loginPassword')?.value||'';
        if(!email||!password){showLogin('Informe e-mail e senha.');return;}
        if(btn){btn.disabled=true;btn.textContent='Entrando...';}
        try{
          const res=await request('login',{email,password},30000);
          const data=res.data||{};
          setToken(data.token||'');currentUser=data.user||null;
          form?.removeEventListener('submit',handler);
          loginPromise=null;
          hideLogin();resolve(currentUser);
        }catch(err){showLogin(err.message||'Não foi possível entrar.');}
        finally{if(btn){btn.disabled=false;btn.textContent='Entrar';}}
      };
      form?.addEventListener('submit',handler);
    });
    return loginPromise;
  }

  function waitForInitialSetup(){
    showInitialSetup();
    if(loginPromise) return loginPromise;
    loginPromise=new Promise(resolve=>{
      const form=document.getElementById('initialSetupForm');
      const btn=document.getElementById('initialSetupBtn');
      const handler=async(e)=>{
        e.preventDefault();
        const name=document.getElementById('initialAdminName')?.value.trim()||'';
        const email=document.getElementById('initialAdminEmail')?.value.trim()||'';
        const password=document.getElementById('initialAdminPassword')?.value||'';
        const confirmPassword=document.getElementById('initialAdminConfirmPassword')?.value||'';
        if(!name||!email||!password||!confirmPassword){showInitialSetup('Preencha todos os campos.',true);return;}
        if(password.length<6){showInitialSetup('A senha deve ter pelo menos 6 caracteres.',true);return;}
        if(password!==confirmPassword){showInitialSetup('A confirmação da senha não confere.',true);return;}
        if(btn){btn.disabled=true;btn.textContent='Criando administrador...';}
        try{
          const res=await request('criarAdministradorInicial',{name,email,password,confirmPassword},30000);
          const data=res.data||{};
          setToken(data.token||'');currentUser=data.user||null;
          hideLogin();loginPromise=null;form?.removeEventListener('submit',handler);resolve(currentUser);
        }catch(err){showInitialSetup(err.message||'Não foi possível criar o administrador.',true);}
        finally{if(btn){btn.disabled=false;btn.textContent='Criar administrador';}}
      };
      form?.addEventListener('submit',handler);
    });
    return loginPromise;
  }

  async function ensureAuthenticated(){
    // Após um logout, sabemos que o sistema já estava configurado.
    // Nesse caso, evita uma nova consulta antes de exibir o login.
    try{
      if(localStorage.getItem('mj_just_logged_out')==='1'){
        localStorage.removeItem('mj_just_logged_out');
        setToken('');currentUser=null;
        clearLoginFields();
        return waitForLogin('Sessão encerrada. Entre novamente para acessar o sistema.');
      }
    }catch(_){}

    // Antes do login, verifica se o sistema ainda precisa criar o primeiro administrador.
    try{
      const status=await request('statusConfiguracao',{},30000);
      if(status.data?.precisaAdministrador===true){
        setToken('');currentUser=null;
        return waitForInitialSetup();
      }
    }catch(err){
      console.warn('[MJ Auth] Não foi possível verificar a configuração inicial:',err);
    }

    const token=getToken();
    if(token){
      try{const res=await request('sessao');currentUser=res.data?.user||null;if(currentUser){hideLogin();return currentUser;}}
      catch(err){if(err.code!=='AUTH_REQUIRED')console.warn('[MJ Auth] Sessão:',err);}
    }
    return waitForLogin();
  }

  async function logout(){
    // Feedback imediato para o usuário.
    const loader=document.getElementById('appLoadingOverlay');
    const loaderTitle=document.getElementById('appLoadingTitle');
    const loaderHint=document.getElementById('appLoadingHint');
    const loaderSpinner=document.getElementById('appLoadingSpinner');
    const loaderIcon=document.getElementById('appLoadingIcon');
    const loaderActions=document.getElementById('appLoadingActions');
    const loaderProgress=document.getElementById('appLoadingProgress');
    const loaderMessage=document.getElementById('appLoadingMessage');

    if(loader){loader.classList.remove('is-hidden');loader.setAttribute('aria-busy','true');loader.dataset.state='loading';}
    if(loaderTitle) loaderTitle.textContent='Saindo do sistema...';
    if(loaderMessage) loaderMessage.textContent='Encerrando sua sessão com segurança.';
    if(loaderHint) loaderHint.textContent='Aguarde alguns instantes.';
    if(loaderSpinner) loaderSpinner.hidden=false;
    if(loaderIcon) loaderIcon.hidden=true;
    if(loaderActions) loaderActions.hidden=true;
    if(loaderProgress) loaderProgress.style.width='65%';

    clearLoginFields();

    try{await request('logout');}catch(err){console.warn('[MJ Auth] Logout no servidor:',err);}

    setToken('');
    currentUser=null;
    loginPromise=null;
    try{sessionStorage.removeItem('mj_active_view');}catch(_){}
    try{localStorage.setItem('mj_just_logged_out','1');}catch(_){}
    clearLoginFields();

    // Recarrega uma única vez para limpar completamente a interface e as permissões
    // do usuário anterior. Na nova carga, ensureAuthenticated() vai direto ao login.
    location.reload();
  }

  function setStatus(state, text) {
    const pill = document.getElementById('cloudConfigStatus'); const sw = document.getElementById('cloudSwitch');
    if (pill) { pill.textContent = text; pill.classList.toggle('off', state !== 'ok'); pill.classList.toggle('on', state === 'ok'); }
    if (sw) sw.classList.toggle('on', state === 'ok');
  }
  function setInfo(text, error = false) {
    const el = document.getElementById('cloudSyncInfo'); if (!el) return;
    el.textContent = text; el.classList.toggle('cloud-error', !!error);
  }

  async function bootstrap() {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.url) { hydrated = true; setStatus('off','Desativado'); setInfo('Banco em nuvem desativado.'); return { connected:false }; }
    if (syncingBootstrap) return { connected:false };
    syncingBootstrap = true; setStatus('loading','Conectando...'); setInfo('Carregando dados da planilha...');
    window.MJAppLoader?.set?.('loading','Conectando ao Google Sheets...',18);
    try {
      const res = await request('bootstrap');
      window.MJAppLoader?.set?.('loading','Recebendo dados permitidos para seu usuário...',52);
      const remote = res.data || {};
      if(remote.mj_current_user) currentUser=remote.mj_current_user;
      for (const key of DATA_KEYS) {
        const fallback = key.includes('config') ? {} : [];
        localStorage.setItem(key, JSON.stringify((key in remote) ? (remote[key] ?? fallback) : fallback));
      }
      hydrated = true; window.MJAppLoader?.set?.('loading','Sincronização concluída. Preparando interface...',76);
      setStatus('ok','Conectado'); setInfo(`Planilha conectada • ${res.spreadsheetName || 'Banco MJ'} • ${new Date().toLocaleString('pt-BR')}`);
      return { connected:true, response:res };
    } catch (err) {
      hydrated = true;
      if(err.code==='AUTH_REQUIRED') throw err;
      setStatus('error','Sem conexão');setInfo(`Não foi possível carregar a planilha. ${err.message}`,true);console.error('[MJ Cloud] Bootstrap:',err);
      return { connected:false,error:err };
    } finally { syncingBootstrap=false; }
  }

  async function syncKey(key,data){
    const cfg=getConfig();if(!hydrated||syncingBootstrap||!cfg.enabled||!cfg.url)return{skipped:true};
    if(!DATA_KEYS.includes(key))throw new Error('Chave de dados não suportada: '+key);
    try{setInfo('Sincronizando alterações com a planilha...');const result=await request('syncKey',{key,data});setStatus('ok','Conectado');setInfo(`Última sincronização: ${new Date().toLocaleString('pt-BR')}`);return result;}
    catch(err){setStatus('error','Sem conexão');setInfo(`Falha ao sincronizar: ${err.message}`,true);console.error('[MJ Cloud] Falha ao sincronizar',key,err);throw err;}
  }

  async function syncAll(){
    const cfg=getConfig();if(!cfg.enabled||!cfg.url)throw new Error('Ative e configure o banco em nuvem.');
    const data={};for(const key of DATA_KEYS){try{data[key]=JSON.parse(localStorage.getItem(key)||'null');}catch(_){data[key]=null;}}
    setInfo('Enviando os dados para a planilha...');const res=await request('syncAll',{data},40000);setStatus('ok','Conectado');setInfo(`Sincronização concluída: ${new Date().toLocaleString('pt-BR')}`);return res;
  }

  function bindSettings(){
    const cfg=getConfig();const url=document.getElementById('cloudApiUrl');const enabled=document.getElementById('cloudEnabled');if(url)url.value=cfg.url||'';if(enabled)enabled.value=String(cfg.enabled!==false);
    document.getElementById('saveGoogleApiBtn')?.addEventListener('click',async()=>{const next={url:normalizeUrl(document.getElementById('cloudApiUrl')?.value),enabled:document.getElementById('cloudEnabled')?.value==='true'};if(next.enabled&&!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec(?:\?.*)?$/.test(next.url)){window.toast?.('Informe a URL /exec publicada pelo Apps Script.');return;}localStorage.setItem(CONFIG_KEY,JSON.stringify(next));window.toast?.('Configuração do banco salva.');if(next.enabled){await bootstrap();location.reload();}else{setStatus('off','Desativado');setInfo('Banco em nuvem desativado.');}});
    document.getElementById('testGoogleApiBtn')?.addEventListener('click',async()=>{const temp={url:normalizeUrl(document.getElementById('cloudApiUrl')?.value),enabled:document.getElementById('cloudEnabled')?.value==='true'};if(!temp.url)return window.toast?.('Informe a URL do Apps Script.');localStorage.setItem(CONFIG_KEY,JSON.stringify(temp));setStatus('loading','Testando...');try{const res=await request('ping');setStatus('ok','Conectado');setInfo(`Conexão validada com “${res.spreadsheetName||'Banco MJ'}”.`);window.toast?.('Conexão com a planilha validada.');}catch(err){setStatus('error','Falha');setInfo(err.message,true);window.toast?.('Não foi possível conectar ao Apps Script.');}});
    document.getElementById('syncGoogleApiBtn')?.addEventListener('click',async()=>{try{await syncAll();window.toast?.('Dados enviados para a planilha.');}catch(err){setStatus('error','Falha');setInfo(err.message,true);window.toast?.(err.message);}});
  }

  async function init(){
    bindSettings();
    // Primeiro valida configuração inicial/sessão.
    // Os dados do sistema só são carregados depois que o usuário estiver autenticado.
    return ensureAuthenticated();
  }

  window.addEventListener('mj-auth-required',()=>{showLogin('Sua sessão expirou. Entre novamente.');});

  window.MJCloud={
    init,request,bootstrap,syncAll,pushKey:syncKey,getConfig,DATA_KEYS,getCurrentUser:()=>currentUser,getToken,logout,
    saveProduct:produto=>request('salvarProduto',{produto},30000),deleteProduct:id=>request('excluirProduto',{id},30000),
    saveQuote:orcamento=>request('salvarOrcamento',{orcamento}),deleteQuote:id=>request('excluirOrcamento',{id}),convertQuote:(id,saleId='')=>request('converterOrcamento',{id,saleId}),sendQuoteEmail:id=>request('enviarOrcamentoEmail',{id},30000),
    finalizeSale:venda=>request('finalizarVenda',{venda},30000),cancelSale:id=>request('cancelarVenda',{id},30000),
    saveFinancial:lancamento=>request('salvarFinanceiro',{lancamento}),markFinancialPaid:id=>request('marcarFinanceiroPago',{id}),
    saveExpense:despesa=>request('salvarDespesa',{despesa}),deleteExpense:id=>request('excluirDespesa',{id}),markExpensePaid:id=>request('marcarDespesaPaga',{id}),
    finalizePurchase:compra=>request('finalizarCompra',{compra},30000),cancelPurchase:id=>request('cancelarCompra',{id},30000),
    uploadReceipt:(entityType,id,fileName,mimeType,base64)=>request('anexarComprovante',{entityType,id,fileName,mimeType,base64},45000),getReceipt:(entityType,id)=>request('obterComprovante',{entityType,id},45000),
    listUsers:()=>request('listarUsuarios',{},30000),saveUser:usuario=>request('salvarUsuario',{usuario},30000),deleteUser:id=>request('excluirUsuario',{id},30000),changeMyPassword:(currentPassword,newPassword)=>request('alterarMinhaSenha',{currentPassword,newPassword},30000),
    getAuditLogs:()=>auditCache.slice(),listAudit:async(filters={})=>{const res=await request('listarAuditoria',{filters},30000);auditCache=Array.isArray(res.data)?res.data:[];return res;}
  };
})();
