/** MJ ADMIN V11 - Financeiro */
function salvarFinanceiro_(item){ if(!item.id)item.id=uid_('ft'); item.updatedAt=nowIso_(); upsertObject_('Financeiro',item); return item; }
function marcarFinanceiroPago_(id){ const item=readObjects_('Financeiro').find(x=>String(x.id)===String(id)); if(!item)throw new Error('Lançamento financeiro não encontrado.'); item.status='Pago'; item.paidAt=todayIso_(); return salvarFinanceiro_(item); }
