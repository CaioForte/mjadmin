/** MJ ADMIN V11.25 - Bootstrap otimizado e carregamento sob demanda */
function isSupportedKey_(key){
  return ['mj_products','mj_clients','mj_suppliers','mj_quotes','mj_sales','mj_purchases','mj_financial_transactions','mj_expenses','mj_infinitepay_config','mj_infinitepay_transactions'].indexOf(key)>=0;
}

function syncKey_(key,data){
  if(!isSupportedKey_(key))throw new Error('Chave não suportada: '+key);
  switch(key){
    case 'mj_products': return salvarProdutos_(arr_(data));
    case 'mj_clients': return salvarClientes_(arr_(data));
    case 'mj_suppliers': return writeObjects_('Fornecedores',arr_(data));
    case 'mj_quotes': writeObjects_('Orcamentos',arr_(data)); replaceChildItems_('OrcamentosItens',arr_(data),'orcamentoId'); return;
    case 'mj_sales': writeObjects_('Vendas',arr_(data)); replaceChildItems_('VendasItens',arr_(data),'vendaId'); return;
    case 'mj_purchases': writeObjects_('Compras',arr_(data)); replaceChildItems_('ComprasItens',arr_(data),'compraId'); return;
    case 'mj_financial_transactions': return writeObjects_('Financeiro',arr_(data));
    case 'mj_expenses': return writeObjects_('Despesas',arr_(data));
    case 'mj_infinitepay_transactions': return writeObjects_('TransacoesInfinitePay',arr_(data));
    case 'mj_infinitepay_config': return salvarConfigInfinitePay_(data||{});
  }
}

function syncAll_(data){
  Object.keys(data||{}).forEach(function(k){if(isSupportedKey_(k))syncKey_(k,data[k]);});
  log_('syncAll','*','Sincronização completa');
}

function loadDataKey_(key){
  switch(String(key||'')){
    case 'mj_products': return readObjects_('Produtos');
    case 'mj_clients': return readObjects_('Clientes');
    case 'mj_suppliers': return readObjects_('Fornecedores');
    case 'mj_quotes': return attachItems_(readObjects_('Orcamentos'),readObjects_('OrcamentosItens'),'orcamentoId');
    case 'mj_sales': return attachItems_(readObjects_('Vendas'),readObjects_('VendasItens'),'vendaId');
    case 'mj_purchases': return attachItems_(readObjects_('Compras'),readObjects_('ComprasItens'),'compraId');
    case 'mj_financial_transactions': return readObjects_('Financeiro');
    case 'mj_expenses': return readObjects_('Despesas');
    case 'mj_infinitepay_config': return readConfig_('mj_infinitepay_config')||{};
    case 'mj_infinitepay_transactions': return readObjects_('TransacoesInfinitePay');
    default: throw new Error('Chave não suportada: '+key);
  }
}

function bootstrapData_(){
  var out={};
  ['mj_products','mj_clients','mj_suppliers','mj_quotes','mj_sales','mj_purchases','mj_financial_transactions','mj_expenses','mj_infinitepay_config','mj_infinitepay_transactions'].forEach(function(k){out[k]=loadDataKey_(k);});
  return out;
}

/** Dados mínimos usados pelo Dashboard. */
function bootstrapLiteData_(){
  var keys=['mj_products','mj_quotes','mj_sales','mj_expenses'];
  var out={};
  keys.forEach(function(k){out[k]=loadDataKey_(k);});
  return out;
}

function podeCarregarKeyUsuario_(user,key){
  var allowed={
    mj_products: temPermissao_(user,'produtos') || temPermissao_(user,'estoque') || temPermissao_(user,'nova-venda') || temPermissao_(user,'orcamentos') || temPermissao_(user,'compras') || temPermissao_(user,'dashboard'),
    mj_clients: temPermissao_(user,'clientes') || temPermissao_(user,'nova-venda') || temPermissao_(user,'orcamentos') || temPermissao_(user,'relatorios'),
    mj_suppliers: temPermissao_(user,'fornecedores') || temPermissao_(user,'compras') || temPermissao_(user,'despesas') || temPermissao_(user,'relatorios'),
    mj_quotes: temPermissao_(user,'orcamentos') || temPermissao_(user,'dashboard') || temPermissao_(user,'relatorios'),
    mj_sales: temPermissao_(user,'vendas') || temPermissao_(user,'nova-venda') || temPermissao_(user,'dashboard') || temPermissao_(user,'relatorios'),
    mj_purchases: temPermissao_(user,'compras') || temPermissao_(user,'relatorios'),
    mj_financial_transactions: temPermissao_(user,'financeiro') || temPermissao_(user,'relatorios'),
    mj_expenses: temPermissao_(user,'despesas') || temPermissao_(user,'dashboard') || temPermissao_(user,'relatorios'),
    mj_infinitepay_config: false,
    mj_infinitepay_transactions: false
  };
  return !!allowed[String(key||'')];
}

function loadKeysDataUsuario_(user,keys){
  var out={};
  arr_(keys).forEach(function(key){
    key=String(key||'');
    if(!isSupportedKey_(key))return;
    if(!podeCarregarKeyUsuario_(user,key))return;
    out[key]=loadDataKey_(key);
  });
  out.mj_current_user=usuarioPublico_(user);
  return out;
}

function bootstrapLiteDataUsuario_(user){
  return loadKeysDataUsuario_(user,['mj_products','mj_quotes','mj_sales','mj_expenses']);
}
