/** MJ ADMIN V11.17 - Compras / entrada de estoque */
function finalizarCompra_(compra){
  if(!compra.id) throw new Error('Compra sem ID.');
  if(!arr_(compra.items).length) throw new Error('A compra precisa ter ao menos um item.');
  if(!compra.supplierId && !compra.supplierName) throw new Error('Fornecedor não informado.');
  return withLock_(function(){
    const existentes=readObjects_('Compras');
    const jaExiste=existentes.find(x=>String(x.id)===String(compra.id));
    if(jaExiste) return {compra:jaExiste,duplicate:true,products:readObjects_('Produtos'),financial:readObjects_('Financeiro')};

    const products=readObjects_('Produtos');
    const moves=readObjects_('MovimentacoesEstoque');
    compra.items=arr_(compra.items).map(function(item){
      const p=products.find(x=>String(x.id)===String(item.productId));
      if(!p) throw new Error('Produto não encontrado: '+(item.name||item.productId||''));
      const qty=num_(item.qty), cost=num_(item.unitCost);
      if(qty<=0) throw new Error('Quantidade inválida para '+p.name+'.');
      if(cost<0) throw new Error('Custo inválido para '+p.name+'.');
      const normalized=Object.assign({},item,{productId:p.id,code:p.code||'',name:p.name||item.name||'',qty:qty,unitCost:cost,previousCost:num_(p.cost)});
      if(produtoRastreiaEstoque_(p)){
        p.stock=num_(p.stock)+qty;
        moves.unshift({id:uid_('mov'),date:compra.date||todayIso_(),productId:p.id,type:'Entrada',qty:qty,source:'Compra',sourceId:compra.id,notes:'Entrada automática da compra '+(compra.num||''),createdAt:nowIso_()});
      }
      if(compra.updateCost!==false) p.cost=cost;
      p.updatedAt=nowIso_();
      return normalized;
    });

    compra.createdAt=compra.createdAt||nowIso_(); compra.updatedAt=nowIso_(); compra.status=compra.status||'Ativa';
    existentes.unshift(compra); writeObjects_('Compras',existentes); replaceItemsForParent_('ComprasItens',compra.id,'compraId',compra.items);
    writeObjects_('Produtos',products); writeObjects_('MovimentacoesEstoque',moves);

    let financial=readObjects_('Financeiro');
    if(compra.generateFinance!==false && !financial.some(f=>f.source==='Compra'&&String(f.sourceId)===String(compra.id))){
      financial.unshift({id:uid_('ft'),type:'Saída',source:'Compra',sourceId:compra.id,description:'Compra '+(compra.num||'')+' - '+(compra.supplierName||'Fornecedor'),category:'Estoque',date:compra.date||todayIso_(),dueDate:compra.dueDate||compra.date||todayIso_(),value:num_(compra.total),payment:compra.payment||'Outro',status:compra.financeStatus==='Pendente'?'Pendente':'Pago',notes:'Lançamento gerado automaticamente pela compra.',createdAt:nowIso_(),paidAt:compra.financeStatus==='Pendente'?'':todayIso_()});
      writeObjects_('Financeiro',financial);
    }
    log_('finalizarCompra',compra.id,compra.num||'');
    return {compra:compra,products:products,financial:financial};
  });
}

function cancelarCompra_(id){
  if(!id) throw new Error('ID da compra não informado.');
  return withLock_(function(){
    const purchases=attachItems_(readObjects_('Compras'),readObjects_('ComprasItens'),'compraId');
    const compra=purchases.find(x=>String(x.id)===String(id));
    if(!compra) throw new Error('Compra não encontrada.');
    if(compra.status==='Cancelada') return {compra:compra,products:readObjects_('Produtos'),financial:readObjects_('Financeiro')};

    const products=readObjects_('Produtos');
    arr_(compra.items).forEach(function(item){
      const p=products.find(x=>String(x.id)===String(item.productId));
      if(!p||!produtoRastreiaEstoque_(p)) return;
      if(num_(p.stock)<num_(item.qty)) throw new Error('Não é possível cancelar: o estoque atual de '+p.name+' é menor que a quantidade desta compra. Estoque atual: '+num_(p.stock)+'.');
    });

    const moves=readObjects_('MovimentacoesEstoque');
    arr_(compra.items).forEach(function(item){
      const p=products.find(x=>String(x.id)===String(item.productId));
      if(!p||!produtoRastreiaEstoque_(p)) return;
      p.stock=num_(p.stock)-num_(item.qty); p.updatedAt=nowIso_();
      moves.unshift({id:uid_('mov'),date:todayIso_(),productId:p.id,type:'Saida',qty:num_(item.qty),source:'CancelamentoCompra',sourceId:compra.id,notes:'Estorno automático da compra '+(compra.num||''),createdAt:nowIso_()});
    });
    writeObjects_('Produtos',products); writeObjects_('MovimentacoesEstoque',moves);

    compra.status='Cancelada'; compra.cancelledAt=nowIso_(); upsertObject_('Compras',compra); replaceItemsForParent_('ComprasItens',compra.id,'compraId',compra.items);
    const financial=readObjects_('Financeiro').filter(f=>!(f.source==='Compra'&&String(f.sourceId)===String(id))); writeObjects_('Financeiro',financial);
    log_('cancelarCompra',id,compra.num||'');
    return {compra:compra,products:products,financial:financial};
  });
}
