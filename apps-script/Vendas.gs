/** MJ ADMIN V11 - Vendas, estoque e lançamento financeiro */
function finalizarVenda_(venda){
  if(!venda.id) throw new Error('Venda sem ID.');
  if(!arr_(venda.items).length) throw new Error('A venda precisa ter ao menos um item.');
  return withLock_(function(){
    const existentes=readObjects_('Vendas');
    const jaExiste=existentes.find(x=>String(x.id)===String(venda.id));
    if(jaExiste) return { venda:jaExiste, duplicate:true };

    const products=readObjects_('Produtos');
    venda.items.forEach(function(item){
      if(!item.productId)return; const p=products.find(x=>String(x.id)===String(item.productId)); if(!p)return;
      if(produtoRastreiaEstoque_(p) && num_(item.qty)>num_(p.stock)) throw new Error('Estoque insuficiente para '+p.name+'. Disponível: '+num_(p.stock));
    });

    venda.createdAt=venda.createdAt||nowIso_(); venda.updatedAt=nowIso_();
    existentes.unshift(venda); writeObjects_('Vendas',existentes);
    replaceItemsForParent_('VendasItens',venda.id,'vendaId',venda.items);

    const moves=readObjects_('MovimentacoesEstoque');
    venda.items.forEach(function(item){
      if(!item.productId)return; const p=products.find(x=>String(x.id)===String(item.productId)); if(!p||!produtoRastreiaEstoque_(p))return;
      p.stock=Math.max(0,num_(p.stock)-num_(item.qty)); p.updatedAt=nowIso_();
      moves.unshift({id:uid_('mov'),date:venda.date||todayIso_(),productId:p.id,type:'Saida',qty:num_(item.qty),source:'Venda',sourceId:venda.id,notes:'Baixa automática da venda '+(venda.num||''),createdAt:nowIso_()});
    });
    writeObjects_('Produtos',products); writeObjects_('MovimentacoesEstoque',moves);

    const financial=readObjects_('Financeiro');
    if(!financial.some(f=>f.source==='Venda' && String(f.sourceId)===String(venda.id))){
      const count=venda.payment==='InfinitePay'?1:Math.max(1,Math.floor(num_(venda.installments)||1));
      const base={type:'Entrada',source:'Venda',sourceId:venda.id,description:'Venda '+(venda.num||''),category:'Vendas',date:venda.date||todayIso_(),dueDate:venda.firstDueDate||venda.date||todayIso_(),value:num_(venda.total),payment:venda.payment||'Outro',status:venda.status==='Pago'?'Pago':'Pendente',notes:venda.payment==='InfinitePay'?'Aguardando confirmação da InfinitePay.':'Lançamento gerado automaticamente pela venda.',createdAt:nowIso_()};
      const parcelas=criarParcelasFinanceiras_(base,count);parcelas.reverse().forEach(function(ft){financial.unshift(ft);});
      writeObjects_('Financeiro',financial);
    }

    if(venda.sourceQuoteId) converterOrcamento_(venda.sourceQuoteId,venda.id);
    log_('finalizarVenda',venda.id,venda.num||'');
    return { venda:venda, products:products, financial:financial };
  });
}

function cancelarVenda_(id){
  if(!id)throw new Error('ID da venda não informado.');
  return withLock_(function(){
    const sales=attachItems_(readObjects_('Vendas'),readObjects_('VendasItens'),'vendaId');
    const sale=sales.find(x=>String(x.id)===String(id)); if(!sale)throw new Error('Venda não encontrada.'); if(sale.status==='Cancelado')return sale;
    sale.status='Cancelado'; sale.cancelledAt=nowIso_(); upsertObject_('Vendas',sale);
    const products=readObjects_('Produtos'), moves=readObjects_('MovimentacoesEstoque');
    arr_(sale.items).forEach(function(item){ const p=products.find(x=>String(x.id)===String(item.productId)); if(!p||!produtoRastreiaEstoque_(p))return; p.stock=num_(p.stock)+num_(item.qty); p.updatedAt=nowIso_(); moves.unshift({id:uid_('mov'),date:todayIso_(),productId:p.id,type:'Entrada',qty:num_(item.qty),source:'CancelamentoVenda',sourceId:sale.id,notes:'Estorno automático da venda '+(sale.num||''),createdAt:nowIso_()}); });
    writeObjects_('Produtos',products); writeObjects_('MovimentacoesEstoque',moves);
    const financial=readObjects_('Financeiro').filter(f=>!(f.source==='Venda'&&String(f.sourceId)===String(id))); writeObjects_('Financeiro',financial);
    log_('cancelarVenda',id,sale.num||''); return {venda:sale,products:products,financial:financial};
  });
}
