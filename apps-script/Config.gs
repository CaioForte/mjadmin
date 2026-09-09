/** MJ ADMIN V11 - Configuração central */
const MJ_DB = {
  version: '11.3.0',
  sheets: {
    products: 'Produtos', clients: 'Clientes', suppliers: 'Fornecedores',
    quotes: 'Orcamentos', quoteItems: 'OrcamentosItens',
    sales: 'Vendas', saleItems: 'VendasItens', stockMoves: 'MovimentacoesEstoque',
    financial: 'Financeiro', expenses: 'Despesas', config: 'Configuracoes',
    infinitePay: 'TransacoesInfinitePay', users: 'Usuarios', logs: 'Logs'
  }
};

const HEADERS = {
  Produtos: ['id','code','name','category','description','unit','cost','price','stock','minStock','supplier','status','updatedAt','json','variablePrice'],
  Clientes: ['id','type','document','name','fantasyName','phone','whatsapp','email','cep','address','city','state','notes','status','createdAt','updatedAt','json'],
  Fornecedores: ['id','name','document','phone','email','status','updatedAt','json'],
  Orcamentos: ['id','num','date','clientId','cliente','subtotal','discount','total','validity','status','paymentTerms','obs','convertedAt','saleId','updatedAt','json'],
  OrcamentosItens: ['id','orcamentoId','productId','code','name','qty','unitPrice','json'],
  Vendas: ['id','num','date','clientId','clientName','seller','subtotal','discount','total','payment','status','sourceQuoteId','obs','createdAt','cancelledAt','updatedAt','json'],
  VendasItens: ['id','vendaId','productId','code','name','qty','unitPrice','json'],
  MovimentacoesEstoque: ['id','date','productId','type','qty','source','sourceId','notes','createdAt','json'],
  Financeiro: ['id','type','source','sourceId','description','category','date','dueDate','value','payment','status','notes','createdAt','paidAt','updatedAt','json'],
  Despesas: ['id','date','dueDate','status','value','description','category','payment','supplier','notes','createdAt','updatedAt','json'],
  Configuracoes: ['chave','valor_json','updatedAt'],
  TransacoesInfinitePay: ['id','saleId','orderNsu','transactionNsu','slug','value','method','status','createdAt','paidAt','receiptUrl','updatedAt','json'],
  Usuarios: ['id','name','email','role','status','createdAt','updatedAt','json'],
  Logs: ['timestamp','action','key','details']
};
