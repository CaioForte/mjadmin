/** MJ ADMIN V11.27.2 - Produtos com auditoria explícita */
function normalizarProduto_(p) {
  p = Object.assign({}, p || {});
  p.variablePrice = !!p.variablePrice;
  if (p.variablePrice) p.price = 0;
  return p;
}

function salvarProdutos_(items) {
  items = arr_(items).map(normalizarProduto_);
  writeObjects_('Produtos', items);
  return items;
}

function produtoRastreiaEstoque_(p) {
  return String(p.unit || '').toUpperCase() !== 'SV' && String(p.category || '').toLowerCase() !== 'serviços';
}

function produtoAuditValue_(field, value) {
  if (field === 'cost' || field === 'price') {
    const n = Number(value || 0);
    return 'R$ ' + n.toFixed(2).replace('.', ',');
  }
  if (field === 'variablePrice') return value ? 'Sim' : 'Não';
  if (field === 'stock' || field === 'minStock') return String(Number(value || 0));
  return String(value == null || value === '' ? '—' : value);
}

function produtoMudancas_(antes, depois) {
  const fields = [
    ['code','Código'], ['name','Nome'], ['category','Categoria'], ['description','Descrição'],
    ['unit','Unidade'], ['cost','Custo'], ['price','Preço de venda'], ['variablePrice','Preço variável'],
    ['stock','Estoque'], ['minStock','Estoque mínimo'], ['supplier','Fornecedor'], ['status','Status']
  ];
  const changes = [];
  fields.forEach(function(pair) {
    const key = pair[0], label = pair[1];
    const oldVal = antes ? antes[key] : undefined;
    const newVal = depois ? depois[key] : undefined;
    const oldCmp = (typeof oldVal === 'number' || typeof newVal === 'number') ? Number(oldVal || 0) : String(oldVal == null ? '' : oldVal);
    const newCmp = (typeof oldVal === 'number' || typeof newVal === 'number') ? Number(newVal || 0) : String(newVal == null ? '' : newVal);
    if (oldCmp !== newCmp) {
      changes.push(label + ': ' + produtoAuditValue_(key, oldVal) + ' → ' + produtoAuditValue_(key, newVal));
    }
  });
  return changes;
}

function salvarProdutoAuditado_(produto) {
  produto = normalizarProduto_(produto);
  if (!produto.id) throw new Error('Produto sem identificador.');
  if (!String(produto.name || '').trim()) throw new Error('Informe o nome do produto.');

  const all = readObjects_('Produtos');
  const idx = all.findIndex(function(p){ return String(p.id || '') === String(produto.id); });
  const antes = idx >= 0 ? Object.assign({}, all[idx]) : null;
  produto.updatedAt = nowIso_();

  if (idx >= 0) all[idx] = Object.assign({}, all[idx], produto);
  else all.unshift(produto);

  writeObjects_('Produtos', all.map(normalizarProduto_));

  const label = String(produto.name || produto.code || produto.id);
  if (!antes) {
    appendAuditLog_('criarProduto', produto.id, label, {
      recordId: produto.id,
      recordLabel: label,
      details: 'Produto cadastrado. Código: ' + String(produto.code || '—') + '; Categoria: ' + String(produto.category || '—') + '.'
    });
  } else {
    const changes = produtoMudancas_(antes, produto);
    appendAuditLog_('alterarProduto', produto.id, label, {
      recordId: produto.id,
      recordLabel: label,
      details: changes.length ? ('Produto atualizado. Alterações: ' + changes.join('; ') + '.') : 'Produto salvo sem alteração de campos.'
    });
  }

  return produto;
}

function excluirProdutoAuditado_(id) {
  id = String(id || '');
  if (!id) throw new Error('Produto não informado.');
  const all = readObjects_('Produtos');
  const produto = all.find(function(p){ return String(p.id || '') === id; });
  if (!produto) throw new Error('Produto não encontrado.');

  writeObjects_('Produtos', all.filter(function(p){ return String(p.id || '') !== id; }));
  const label = String(produto.name || produto.code || produto.id);
  appendAuditLog_('excluirProduto', id, label, {
    recordId: id,
    recordLabel: label,
    details: 'Produto excluído. Código: ' + String(produto.code || '—') + '; Categoria: ' + String(produto.category || '—') + '.'
  });
  return { id:id, name:produto.name || '', code:produto.code || '' };
}
