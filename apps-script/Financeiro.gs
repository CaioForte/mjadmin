/** MJ ADMIN V11.18 - Financeiro, contas a pagar/receber e parcelamento */
function adicionarMesesIso_(dateStr, months){
  const parts=String(dateStr||todayIso_()).slice(0,10).split('-').map(Number);
  const y=parts[0],m=parts[1],d=parts[2];
  const dt=new Date(y,m-1+Number(months||0),1,12,0,0);
  const last=new Date(dt.getFullYear(),dt.getMonth()+1,0).getDate();
  const day=Math.min(d,last);
  return Utilities.formatDate(new Date(dt.getFullYear(),dt.getMonth(),day,12,0,0),Session.getScriptTimeZone()||'America/Fortaleza','yyyy-MM-dd');
}
function valoresParcelas_(total,count){
  count=Math.max(1,Math.floor(num_(count)||1));
  const cents=Math.round(num_(total)*100),base=Math.floor(cents/count),rest=cents-base*count,out=[];
  for(let i=0;i<count;i++)out.push((base+(i<rest?1:0))/100);
  return out;
}
function criarParcelasFinanceiras_(base,count){
  count=Math.max(1,Math.floor(num_(count)||1));
  const vals=valoresParcelas_(base.value,count),group=uid_('grp'),out=[];
  for(let i=0;i<count;i++){
    out.push(Object.assign({},base,{
      id:uid_('ft'),
      description:count>1?(base.description+' • Parcela '+(i+1)+'/'+count):base.description,
      dueDate:adicionarMesesIso_(base.dueDate||base.date||todayIso_(),i),
      value:vals[i],installmentNumber:i+1,installmentTotal:count,installmentGroupId:group,
      createdAt:base.createdAt||nowIso_(),updatedAt:nowIso_(),paidAt:base.status==='Pago'?(base.paidAt||todayIso_()):''
    }));
  }
  return out;
}
function salvarFinanceiro_(item){ if(!item.id)item.id=uid_('ft'); item.updatedAt=nowIso_(); upsertObject_('Financeiro',item); return item; }
function marcarFinanceiroPago_(id){
  const all=readObjects_('Financeiro'),item=all.find(x=>String(x.id)===String(id));
  if(!item)throw new Error('Lançamento financeiro não encontrado.');
  item.status='Pago';item.paidAt=todayIso_();item.updatedAt=nowIso_();writeObjects_('Financeiro',all);
  if(item.source==='Venda'&&item.sourceId){
    const related=all.filter(x=>x.source==='Venda'&&String(x.sourceId)===String(item.sourceId));
    const sale=readObjects_('Vendas').find(x=>String(x.id)===String(item.sourceId));
    if(sale){sale.status=related.length&&related.every(x=>x.status==='Pago')?'Pago':'Pendente';upsertObject_('Vendas',sale);}
  }
  if(item.source==='Compra'&&item.sourceId){
    const related=all.filter(x=>x.source==='Compra'&&String(x.sourceId)===String(item.sourceId));
    const purchase=readObjects_('Compras').find(x=>String(x.id)===String(item.sourceId));
    if(purchase){purchase.financeStatus=related.length&&related.every(x=>x.status==='Pago')?'Pago':'Pendente';upsertObject_('Compras',purchase);}
  }
  if(item.source==='Despesa'&&item.sourceId){
    const expense=readObjects_('Despesas').find(x=>String(x.id)===String(item.sourceId));
    if(expense){expense.status='Pago';upsertObject_('Despesas',expense);}
  }
  return item;
}
