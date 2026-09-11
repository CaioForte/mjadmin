/** MJ ADMIN V11 - Bootstrap e compatibilidade de sincronização */
function isSupportedKey_(key){ return ['mj_products','mj_clients','mj_suppliers','mj_quotes','mj_sales','mj_purchases','mj_financial_transactions','mj_expenses','mj_infinitepay_config','mj_infinitepay_transactions'].indexOf(key)>=0; }
function syncKey_(key,data){
  if(!isSupportedKey_(key))throw new Error('Chave não suportada: '+key);
  let before=null,result=null;
  if(key==='mj_clients')before=readObjects_('Clientes');
  if(key==='mj_suppliers')before=readObjects_('Fornecedores');
  switch(key){
    case 'mj_products': result=salvarProdutos_(arr_(data)); break;
    case 'mj_clients': result=salvarClientes_(arr_(data)); break;
    case 'mj_suppliers': result=writeObjects_('Fornecedores',arr_(data)); break;
    case 'mj_quotes': writeObjects_('Orcamentos',arr_(data)); replaceChildItems_('OrcamentosItens',arr_(data),'orcamentoId'); break;
    case 'mj_sales': writeObjects_('Vendas',arr_(data)); replaceChildItems_('VendasItens',arr_(data),'vendaId'); break;
    case 'mj_purchases': writeObjects_('Compras',arr_(data)); replaceChildItems_('ComprasItens',arr_(data),'compraId'); break;
    case 'mj_financial_transactions': result=writeObjects_('Financeiro',arr_(data)); break;
    case 'mj_expenses': result=writeObjects_('Despesas',arr_(data)); break;
    case 'mj_infinitepay_transactions': result=writeObjects_('TransacoesInfinitePay',arr_(data)); break;
    case 'mj_infinitepay_config': result=salvarConfigInfinitePay_(data||{}); break;
  }
  if(before)registrarMudancasSync_(key,before,arr_(data));
  return result;
}
function syncAll_(data){ Object.keys(data||{}).forEach(function(k){if(isSupportedKey_(k))syncKey_(k,data[k]);}); log_('syncAll','*','Sincronização completa'); }
function bootstrapData_(){ return {
  mj_products:readObjects_('Produtos'), mj_clients:readObjects_('Clientes'), mj_suppliers:readObjects_('Fornecedores'),
  mj_quotes:attachItems_(readObjects_('Orcamentos'),readObjects_('OrcamentosItens'),'orcamentoId'),
  mj_sales:attachItems_(readObjects_('Vendas'),readObjects_('VendasItens'),'vendaId'),
  mj_purchases:attachItems_(readObjects_('Compras'),readObjects_('ComprasItens'),'compraId'),
  mj_financial_transactions:readObjects_('Financeiro'), mj_expenses:readObjects_('Despesas'),
  mj_infinitepay_config:readConfig_('mj_infinitepay_config')||{}, mj_infinitepay_transactions:readObjects_('TransacoesInfinitePay')
}; }
