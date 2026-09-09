/** MJ ADMIN V11 - Produtos */
function salvarProdutos_(items){ items=arr_(items).map(function(p){ p=Object.assign({},p); p.variablePrice=!!p.variablePrice; if(p.variablePrice) p.price=0; return p; }); writeObjects_('Produtos',items); return items; }
function produtoRastreiaEstoque_(p){ return String(p.unit||'').toUpperCase()!=='SV' && String(p.category||'').toLowerCase()!=='serviços'; }
