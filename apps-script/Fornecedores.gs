/** MJ ADMIN V11.17 - Fornecedores */
function salvarFornecedor_(fornecedor){
  if(!fornecedor||!String(fornecedor.name||'').trim()) throw new Error('Nome do fornecedor não informado.');
  fornecedor.id=fornecedor.id||uid_('forn'); fornecedor.updatedAt=nowIso_(); fornecedor.createdAt=fornecedor.createdAt||nowIso_();
  return upsertObject_('Fornecedores',fornecedor);
}
function excluirFornecedor_(id){ if(!id)throw new Error('ID do fornecedor não informado.'); deleteObject_('Fornecedores',id); return true; }
