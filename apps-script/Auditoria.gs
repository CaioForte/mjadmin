/** MJ ADMIN V11.27.1 - Auditoria centralizada e carregamento sob demanda */
var MJ_AUDIT_ACTOR = null;

function setAuditActor_(user) {
  MJ_AUDIT_ACTOR = user ? usuarioPublico_(user) : null;
}

function auditActionMeta_(action) {
  const map = {
    login:['Segurança','Login','Acesso ao sistema','security'],
    logout:['Segurança','Logout','Saída do sistema','security'],
    criarAdministradorInicial:['Usuários','Criação','Administrador inicial criado','security'],
    salvarUsuario:['Usuários','Alteração','Usuário salvo','security'],
    excluirUsuario:['Usuários','Exclusão','Usuário excluído','security'],
    alterarSenha:['Usuários','Senha','Senha alterada','security'],
    criarProduto:['Produtos','Criação','Produto criado','info'],
    alterarProduto:['Produtos','Alteração','Produto alterado','info'],
    excluirProduto:['Produtos','Exclusão','Produto excluído','info'],
    criarCliente:['Clientes','Criação','Cliente criado','info'],
    alterarCliente:['Clientes','Alteração','Cliente alterado','info'],
    excluirCliente:['Clientes','Exclusão','Cliente excluído','info'],
    criarFornecedor:['Fornecedores','Criação','Fornecedor criado','info'],
    alterarFornecedor:['Fornecedores','Alteração','Fornecedor alterado','info'],
    excluirFornecedor:['Fornecedores','Exclusão','Fornecedor excluído','info'],
    salvarOrcamento:['Orçamentos','Salvamento','Orçamento salvo','info'],
    excluirOrcamento:['Orçamentos','Exclusão','Orçamento excluído','info'],
    converterOrcamento:['Orçamentos','Conversão','Orçamento convertido em venda','info'],
    enviarOrcamentoEmail:['Orçamentos','E-mail','Orçamento enviado por e-mail','info'],
    finalizarVenda:['Vendas','Finalização','Venda finalizada','info'],
    cancelarVenda:['Vendas','Cancelamento','Venda cancelada','warning'],
    finalizarCompra:['Compras','Finalização','Compra finalizada','info'],
    cancelarCompra:['Compras','Cancelamento','Compra cancelada','warning'],
    anexarComprovante:['Comprovantes','Anexo','Comprovante anexado','info'],
    salvarFinanceiro:['Financeiro','Salvamento','Lançamento financeiro salvo','info'],
    marcarFinanceiroPago:['Financeiro','Baixa','Lançamento marcado como pago','info'],
    salvarDespesa:['Despesas','Salvamento','Despesa salva','info'],
    excluirDespesa:['Despesas','Exclusão','Despesa excluída','warning'],
    marcarDespesaPaga:['Despesas','Baixa','Despesa marcada como paga','info'],
    syncAll:['Sistema','Sincronização','Sincronização completa','info'],
    error:['Sistema','Erro','Erro de processamento','error']
  };
  const m = map[String(action || '')] || ['Sistema','Ação',String(action || 'Ação'),'info'];
  return { module:m[0], label:m[1], description:m[2], type:m[3] };
}

function sanitizeAuditText_(value) {
  let text = String(value == null ? '' : value);
  text = text.replace(/(password|senha|token|passwordHash|passwordSalt)\s*[:=]\s*[^,;\s]+/gi, '$1=[oculto]');
  if (text.length > 900) text = text.slice(0, 900) + '…';
  return text;
}

function appendAuditLog_(action, key, details, extra) {
  try {
    const sh = getDb_().getSheetByName('Logs');
    if (!sh) return;
    const meta = auditActionMeta_(action);
    const actor = MJ_AUDIT_ACTOR || {};
    extra = extra || {};
    const recordId = String(extra.recordId || key || '');
    const recordLabel = sanitizeAuditText_(extra.recordLabel || details || '');
    const log = {
      timestamp: nowIso_(),
      action: String(action || ''),
      key: String(key || ''),
      details: sanitizeAuditText_(extra.details != null ? extra.details : details),
      id: uid_('log'),
      userId: String(actor.id || extra.userId || ''),
      userName: sanitizeAuditText_(actor.name || extra.userName || 'Sistema'),
      userEmail: sanitizeAuditText_(actor.email || extra.userEmail || ''),
      module: String(extra.module || meta.module),
      recordId: recordId,
      recordLabel: recordLabel,
      type: String(extra.type || meta.type)
    };
    const headers = HEADERS.Logs;
    const row = headers.map(function(h){ return h === 'json' ? JSON.stringify(log) : scalar_(log[h]); });
    sh.appendRow(row);
  } catch (_) {}
}

function enrichAuditLog_(log) {
  log = Object.assign({}, log || {});
  const meta = auditActionMeta_(log.action);
  if (!log.module) log.module = meta.module;
  if (!log.type) log.type = meta.type;
  if (!log.recordId) log.recordId = log.key || '';
  if (!log.recordLabel) log.recordLabel = log.details || '';
  if (!log.userName) log.userName = 'Sistema';
  log.actionLabel = meta.label;
  log.actionDescription = meta.description;
  return log;
}

function listarAuditoria_(filters) {
  filters = filters || {};
  const limit = Math.max(1, Math.min(2000, Number(filters.limit || 1000)));
  let rows = readObjects_('Logs').map(enrichAuditLog_);
  // Não mistura logs técnicos de sincronização com a auditoria funcional.
  rows = rows.filter(function(log){ return String(log.action || '') !== 'syncAll'; });
  rows.sort(function(a,b){ return String(b.timestamp || '').localeCompare(String(a.timestamp || '')); });

  const moduleFilter = String(filters.module || '').trim().toLowerCase();
  const userFilter = String(filters.user || '').trim().toLowerCase();
  const actionFilter = String(filters.action || '').trim().toLowerCase();
  const search = String(filters.search || '').trim().toLowerCase();
  const start = String(filters.start || '').trim();
  const end = String(filters.end || '').trim();

  rows = rows.filter(function(log){
    const ts = String(log.timestamp || '');
    if (start && ts.slice(0,10) < start) return false;
    if (end && ts.slice(0,10) > end) return false;
    if (moduleFilter && String(log.module || '').toLowerCase() !== moduleFilter) return false;
    if (userFilter && String(log.userEmail || log.userName || '').toLowerCase() !== userFilter) return false;
    if (actionFilter && String(log.action || '').toLowerCase() !== actionFilter) return false;
    if (search) {
      const hay = [log.userName,log.userEmail,log.module,log.action,log.actionLabel,log.details,log.recordId,log.recordLabel].join(' ').toLowerCase();
      if (hay.indexOf(search) < 0) return false;
    }
    return true;
  });
  return rows.slice(0, limit);
}

function auditRecordLabel_(obj) {
  obj = obj || {};
  return String(obj.num || obj.code || obj.name || obj.fantasyName || obj.description || obj.email || obj.id || '').trim();
}

function auditComparable_(obj) {
  const clone = Object.assign({}, obj || {});
  delete clone.updatedAt;
  delete clone.createdAt;
  delete clone.json;
  delete clone.passwordHash;
  delete clone.passwordSalt;
  return JSON.stringify(clone);
}

function registrarMudancasSync_(key, before, after) {
  const cfg = {
    mj_products:['Produto','criarProduto','alterarProduto','excluirProduto'],
    mj_clients:['Cliente','criarCliente','alterarCliente','excluirCliente'],
    mj_suppliers:['Fornecedor','criarFornecedor','alterarFornecedor','excluirFornecedor']
  }[String(key || '')];
  if (!cfg) return;
  before = arr_(before); after = arr_(after);
  const oldMap = {}; const newMap = {};
  before.forEach(function(x){ if (x && x.id) oldMap[String(x.id)] = x; });
  after.forEach(function(x){ if (x && x.id) newMap[String(x.id)] = x; });

  Object.keys(newMap).forEach(function(id){
    const current = newMap[id], old = oldMap[id];
    const label = auditRecordLabel_(current);
    if (!old) {
      appendAuditLog_(cfg[1], id, label, {recordId:id,recordLabel:label,details:cfg[0]+' cadastrado.'});
    } else if (auditComparable_(old) !== auditComparable_(current)) {
      appendAuditLog_(cfg[2], id, label, {recordId:id,recordLabel:label,details:cfg[0]+' atualizado.'});
    }
  });
  Object.keys(oldMap).forEach(function(id){
    if (!newMap[id]) {
      const label = auditRecordLabel_(oldMap[id]);
      appendAuditLog_(cfg[3], id, label, {recordId:id,recordLabel:label,details:cfg[0]+' excluído.'});
    }
  });
}
