/** MJ ADMIN V11 - Bootstrap e compatibilidade de sincronização */
function isSupportedKey_(key){ return ['mj_products','mj_clients','mj_quotes','mj_sales','mj_financial_transactions','mj_expenses','mj_infinitepay_config','mj_infinitepay_transactions'].indexOf(key)>=0; }
function syncKey_(key,data){
  if(!isSupportedKey_(key))throw new Error('Chave não suportada: '+key);
  switch(key){
    case 'mj_products': return salvarProdutos_(arr_(data));
    case 'mj_clients': return salvarClientes_(arr_(data));
    case 'mj_quotes': writeObjects_('Orcamentos',arr_(data)); replaceChildItems_('OrcamentosItens',arr_(data),'orcamentoId'); return;
    case 'mj_sales': writeObjects_('Vendas',arr_(data)); replaceChildItems_('VendasItens',arr_(data),'vendaId'); return;
    case 'mj_financial_transactions': return writeObjects_('Financeiro',arr_(data));
    case 'mj_expenses': return writeObjects_('Despesas',arr_(data));
    case 'mj_infinitepay_transactions': return writeObjects_('TransacoesInfinitePay',arr_(data));
    case 'mj_infinitepay_config': return salvarConfigInfinitePay_(data||{});
  }
}
function syncAll_(data){ Object.keys(data||{}).forEach(function(k){if(isSupportedKey_(k))syncKey_(k,data[k]);}); log_('syncAll','*','Sincronização completa'); }
function bootstrapData_(){ return {
  mj_products:readObjects_('Produtos'), mj_clients:readObjects_('Clientes'),
  mj_quotes:attachItems_(readObjects_('Orcamentos'),readObjects_('OrcamentosItens'),'orcamentoId'),
  mj_sales:attachItems_(readObjects_('Vendas'),readObjects_('VendasItens'),'vendaId'),
  mj_financial_transactions:readObjects_('Financeiro'), mj_expenses:readObjects_('Despesas'),
  mj_infinitepay_config:readConfig_('mj_infinitepay_config')||{}, mj_infinitepay_transactions:readObjects_('TransacoesInfinitePay')
}; }
