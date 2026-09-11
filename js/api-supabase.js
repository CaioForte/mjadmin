/* =====================================================
   MJ ADMIN V12.0.6 - SUPABASE / POSTGRESQL
   Fase 6: Auth + Produtos + Clientes + Fornecedores + Orçamentos + Vendas + Estoque.

   Mantém o mesmo contrato window.MJCloud do api.js atual,
   permitindo preservar o main.js sem alterações.
   ===================================================== */
(() => {
  const DATA_KEYS = [
    'mj_products','mj_clients','mj_suppliers','mj_quotes','mj_sales','mj_purchases',
    'mj_financial_transactions','mj_expenses','mj_infinitepay_config','mj_infinitepay_transactions'
  ];

  const cfg = window.MJ_CONFIG?.supabase || {};
  const url = String(cfg.url || '').trim();
  const key = String(cfg.publishableKey || '').trim();
  let client = null;
  let currentUser = null;
  let loginPromise = null;
  let auditCache = [];

  function requireConfig() {
    if (!url || !key) {
      throw new Error('Supabase não configurado. Preencha url e publishableKey em js/config.js.');
    }
    if (!window.supabase?.createClient) {
      throw new Error('Biblioteca do Supabase não foi carregada. Verifique sua conexão com a internet.');
    }
  }

  function getClient() {
    requireConfig();
    if (!client) {
      client = window.supabase.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }
    return client;
  }

  function showLogin(message = '', isError = false) {
    const overlay = document.getElementById('loginOverlay');
    const normal = document.getElementById('normalLoginArea');
    const setup = document.getElementById('initialSetupArea');
    const msg = document.getElementById('loginMessage');
    if (normal) normal.hidden = false;
    if (setup) setup.hidden = true;
    if (msg) {
      msg.textContent = message || 'Entre com seu usuário para acessar o sistema.';
      msg.classList.toggle('error', !!isError);
    }
    if (overlay) {
      overlay.classList.add('show');
      overlay.setAttribute('aria-hidden', 'false');
    }
    setTimeout(() => document.getElementById('loginEmail')?.focus(), 80);
  }

  function hideLogin() {
    const overlay = document.getElementById('loginOverlay');
    if (overlay) {
      overlay.classList.remove('show');
      overlay.setAttribute('aria-hidden', 'true');
    }
  }

  function clearLoginFields() {
    const form = document.getElementById('loginForm');
    try { form?.reset(); } catch (_) {}
    const email = document.getElementById('loginEmail');
    const password = document.getElementById('loginPassword');
    if (email) email.value = '';
    if (password) password.value = '';
  }

  function profileToUser(profile, authUser) {
    const rawPermissions = profile?.permissions;
    return {
      id: profile?.id || authUser?.id || '',
      name: profile?.name || authUser?.email || 'Usuário',
      email: profile?.email || authUser?.email || '',
      role: profile?.role || 'Vendedor',
      status: profile?.status || 'Ativo',
      permissions: Array.isArray(rawPermissions) ? rawPermissions : [],
      lastLoginAt: profile?.last_login_at || null
    };
  }

  async function loadProfile(authUser) {
    if (!authUser?.id) throw new Error('Usuário autenticado sem identificador.');
    const sb = getClient();
    const { data, error } = await sb
      .from('profiles')
      .select('id,name,email,role,status,permissions,last_login_at')
      .eq('id', authUser.id)
      .single();
    if (error) throw new Error('Não foi possível carregar o perfil do usuário: ' + error.message);
    if (String(data?.status || '').toLowerCase() !== 'ativo') {
      await sb.auth.signOut();
      throw new Error('Este usuário está inativo.');
    }
    currentUser = profileToUser(data, authUser);
    return currentUser;
  }

  async function useSession(session) {
    if (!session?.user) return null;
    await loadProfile(session.user);
    hideLogin();
    return currentUser;
  }

  function waitForLogin(message = '') {
    showLogin(message, false);
    if (loginPromise) return loginPromise;

    loginPromise = new Promise(resolve => {
      const form = document.getElementById('loginForm');
      const btn = document.getElementById('loginBtn');

      const handler = async event => {
        event.preventDefault();
        const email = document.getElementById('loginEmail')?.value.trim() || '';
        const password = document.getElementById('loginPassword')?.value || '';
        if (!email || !password) {
          showLogin('Informe e-mail e senha.', true);
          return;
        }

        if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
        try {
          const sb = getClient();
          const { data, error } = await sb.auth.signInWithPassword({ email, password });
          if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : error.message);
          await useSession(data.session);
          form?.removeEventListener('submit', handler);
          loginPromise = null;
          resolve(currentUser);
        } catch (err) {
          showLogin(err.message || 'Não foi possível entrar.', true);
        } finally {
          if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
        }
      };

      form?.addEventListener('submit', handler);
    });

    return loginPromise;
  }

  async function init() {
    const sb = getClient();
    const { data, error } = await sb.auth.getSession();
    if (error) console.warn('[MJ Supabase] Sessão:', error);
    if (data?.session?.user) {
      try { return await useSession(data.session); }
      catch (err) { console.warn('[MJ Supabase] Perfil:', err); }
    }
    currentUser = null;
    return waitForLogin();
  }

  function rowToProduct(row) {
    const extra = row?.data && typeof row.data === 'object' ? row.data : {};
    return {
      ...extra,
      id: row.id,
      code: row.code || '',
      name: row.name || '',
      category: row.category || '',
      description: row.description || '',
      unit: row.unit || 'UN',
      cost: Number(row.cost || 0),
      price: Number(row.price || 0),
      stock: Number(row.stock || 0),
      minStock: Number(row.min_stock || 0),
      supplier: row.supplier || '',
      status: row.status || 'Ativo',
      variablePrice: !!row.variable_price
    };
  }

  function productToRow(p) {
    return {
      id: String(p.id),
      code: p.code || null,
      name: p.name || '',
      category: p.category || null,
      description: p.description || null,
      unit: p.unit || null,
      cost: Number(p.cost || 0),
      price: p.variablePrice ? 0 : Number(p.price || 0),
      stock: Number(p.stock || 0),
      min_stock: Number(p.minStock || 0),
      supplier: p.supplier || null,
      status: p.status || 'Ativo',
      variable_price: !!p.variablePrice,
      updated_at: new Date().toISOString(),
      data: p
    };
  }

  function rowToClient(row) {
    const extra = row?.data && typeof row.data === 'object' ? row.data : {};
    return {
      ...extra,
      id: row.id,
      type: row.type || 'PF',
      document: row.document || '',
      name: row.name || '',
      tradeName: row.fantasy_name || '',
      phone: row.phone || '',
      whatsapp: row.whatsapp || '',
      email: row.email || '',
      zip: row.cep || '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      notes: row.notes || '',
      status: row.status || 'Ativo'
    };
  }

  function clientToRow(c) {
    return {
      id: String(c.id),
      type: c.type || 'PF',
      document: c.document || null,
      name: c.name || '',
      fantasy_name: c.tradeName || null,
      phone: c.phone || null,
      whatsapp: c.whatsapp || null,
      email: c.email || null,
      cep: c.zip || null,
      address: c.address || null,
      city: c.city || null,
      state: c.state || null,
      notes: c.notes || null,
      status: c.status || 'Ativo',
      updated_at: new Date().toISOString(),
      data: c
    };
  }

  function rowToSupplier(row) {
    const extra = row?.data && typeof row.data === 'object' ? row.data : {};
    return {
      ...extra,
      id: row.id,
      name: row.name || '',
      document: row.document || '',
      phone: row.phone || '',
      whatsapp: row.whatsapp || '',
      email: row.email || '',
      contact: row.contact || '',
      notes: row.notes || '',
      status: row.status || 'Ativo',
      createdAt: row.created_at || extra.createdAt || null,
      updatedAt: row.updated_at || extra.updatedAt || null
    };
  }

  function supplierToRow(s) {
    return {
      id: String(s.id),
      name: s.name || '',
      document: s.document || null,
      phone: s.phone || null,
      whatsapp: s.whatsapp || null,
      email: s.email || null,
      contact: s.contact || null,
      notes: s.notes || null,
      status: s.status || 'Ativo',
      updated_at: new Date().toISOString(),
      data: s
    };
  }


  function rowToQuote(row, items = []) {
    const extra = row?.data && typeof row.data === 'object' ? row.data : {};
    return {
      ...extra,
      id: row.id,
      num: row.num || extra.num || '',
      date: row.date || extra.date || '',
      clientId: row.client_id || extra.clientId || '',
      cliente: row.client_name || extra.cliente || '',
      items,
      subtotal: Number(row.subtotal || 0),
      discount: Number(row.discount || 0),
      total: Number(row.total || 0),
      validity: row.validity || extra.validity || '',
      status: row.status || extra.status || 'Pendente',
      paymentTerms: row.payment_terms || extra.paymentTerms || '',
      obs: row.obs || extra.obs || '',
      convertedAt: row.converted_at || extra.convertedAt || null,
      saleId: row.sale_id || extra.saleId || '',
      updatedAt: row.updated_at || extra.updatedAt || null
    };
  }

  function quoteToRow(q) {
    const cleanData = { ...q };
    delete cleanData.items;
    return {
      id: String(q.id),
      num: q.num || null,
      date: q.date || null,
      client_id: q.clientId || null,
      client_name: q.cliente || null,
      subtotal: Number(q.subtotal || 0),
      discount: Number(q.discount || 0),
      total: Number(q.total || 0),
      validity: q.validity || null,
      status: q.status || 'Pendente',
      payment_terms: q.paymentTerms || null,
      obs: q.obs || null,
      converted_at: q.convertedAt || null,
      sale_id: q.saleId || null,
      updated_at: new Date().toISOString(),
      data: cleanData
    };
  }

  function rowToQuoteItem(row) {
    const extra = row?.data && typeof row.data === 'object' ? row.data : {};
    return {
      ...extra,
      id: row.id,
      productId: row.product_id || extra.productId || '',
      code: row.code || extra.code || '',
      name: row.name || extra.name || 'Item',
      qty: Number(row.qty || 0),
      unitPrice: Number(row.unit_price || 0)
    };
  }

  function quoteItemToRow(item, quoteId) {
    return {
      id: String(item.id),
      quote_id: String(quoteId),
      product_id: item.productId || null,
      code: item.code || null,
      name: item.name || 'Item',
      qty: Number(item.qty || 0),
      unit_price: Number(item.unitPrice || 0),
      data: item
    };
  }


  function rowToSale(row, items = []) {
    const extra = row?.data && typeof row.data === 'object' ? row.data : {};
    return {
      ...extra,
      id: row.id,
      num: row.num || extra.num || '',
      date: row.date || extra.date || '',
      clientId: row.client_id || extra.clientId || '',
      clientName: row.client_name || extra.clientName || '',
      seller: row.seller || extra.seller || '',
      items,
      subtotal: Number(row.subtotal || 0),
      discount: Number(row.discount || 0),
      total: Number(row.total || 0),
      payment: row.payment || extra.payment || '',
      status: row.status || extra.status || 'Pendente',
      sourceQuoteId: row.source_quote_id || extra.sourceQuoteId || '',
      obs: row.obs || extra.obs || '',
      installments: Number(row.installments || 1),
      firstDueDate: row.first_due_date || extra.firstDueDate || '',
      receiptFileId: row.receipt_file_id || extra.receiptFileId || '',
      receiptFileName: row.receipt_file_name || extra.receiptFileName || '',
      receiptUrl: row.receipt_url || extra.receiptUrl || '',
      receiptUploadedAt: row.receipt_uploaded_at || extra.receiptUploadedAt || null,
      createdAt: row.created_at || extra.createdAt || null,
      cancelledAt: row.cancelled_at || extra.cancelledAt || null,
      updatedAt: row.updated_at || extra.updatedAt || null
    };
  }

  function saleToRow(sale) {
    const cleanData = { ...sale };
    delete cleanData.items;
    return {
      id: String(sale.id),
      num: sale.num || null,
      date: sale.date || null,
      client_id: sale.clientId || null,
      client_name: sale.clientName || null,
      seller: sale.seller || null,
      subtotal: Number(sale.subtotal || 0),
      discount: Number(sale.discount || 0),
      total: Number(sale.total || 0),
      payment: sale.payment || null,
      status: sale.status || 'Pendente',
      source_quote_id: sale.sourceQuoteId || null,
      obs: sale.obs || null,
      installments: Math.max(1, Number(sale.installments || 1)),
      first_due_date: sale.firstDueDate || null,
      receipt_file_id: sale.receiptFileId || null,
      receipt_file_name: sale.receiptFileName || null,
      receipt_url: sale.receiptUrl || null,
      receipt_uploaded_at: sale.receiptUploadedAt || null,
      created_at: sale.createdAt || new Date().toISOString(),
      cancelled_at: sale.cancelledAt || null,
      updated_at: new Date().toISOString(),
      data: cleanData
    };
  }

  function rowToSaleItem(row) {
    const extra = row?.data && typeof row.data === 'object' ? row.data : {};
    return {
      ...extra,
      id: row.id,
      productId: row.product_id || extra.productId || '',
      code: row.code || extra.code || '',
      name: row.name || extra.name || 'Item',
      qty: Number(row.qty || 0),
      unitPrice: Number(row.unit_price || 0)
    };
  }

  function saleItemToRow(item, saleId) {
    return {
      id: String(item.id),
      sale_id: String(saleId),
      product_id: item.productId || null,
      code: item.code || null,
      name: item.name || 'Item',
      qty: Number(item.qty || 0),
      unit_price: Number(item.unitPrice || 0),
      data: item
    };
  }



  function rowToPurchase(row, items = []) {
    const extra = row?.data && typeof row.data === 'object' ? row.data : {};
    return {
      ...extra,
      id: row.id,
      num: row.num || extra.num || '',
      date: row.date || extra.date || '',
      supplierId: row.supplier_id || extra.supplierId || '',
      supplierName: row.supplier_name || extra.supplierName || '',
      items,
      subtotal: Number(row.subtotal || 0),
      discount: Number(row.discount || 0),
      freight: Number(row.freight || 0),
      total: Number(row.total || 0),
      payment: row.payment || extra.payment || '',
      financeStatus: row.finance_status || extra.financeStatus || 'Pago',
      generateFinance: !!row.generate_finance,
      updateCost: row.update_cost !== false,
      dueDate: row.due_date || extra.dueDate || '',
      notes: row.notes || extra.notes || '',
      status: row.status || extra.status || 'Ativa',
      installments: Number(row.installments || 1),
      receiptFileId: row.receipt_file_id || extra.receiptFileId || '',
      receiptFileName: row.receipt_file_name || extra.receiptFileName || '',
      receiptUrl: row.receipt_url || extra.receiptUrl || '',
      receiptUploadedAt: row.receipt_uploaded_at || extra.receiptUploadedAt || null,
      createdAt: row.created_at || extra.createdAt || null,
      cancelledAt: row.cancelled_at || extra.cancelledAt || null,
      updatedAt: row.updated_at || extra.updatedAt || null
    };
  }

  function purchaseToRow(purchase) {
    const cleanData = { ...purchase };
    delete cleanData.items;
    return {
      id: String(purchase.id), num: purchase.num || null, date: purchase.date || null,
      supplier_id: purchase.supplierId || null, supplier_name: purchase.supplierName || null,
      subtotal: Number(purchase.subtotal || 0), discount: Number(purchase.discount || 0),
      freight: Number(purchase.freight || 0), total: Number(purchase.total || 0),
      payment: purchase.payment || null, finance_status: purchase.financeStatus || 'Pago',
      generate_finance: !!purchase.generateFinance, update_cost: purchase.updateCost !== false,
      due_date: purchase.dueDate || null, notes: purchase.notes || null,
      status: purchase.status || 'Ativa', installments: Math.max(1, Number(purchase.installments || 1)),
      receipt_file_id: purchase.receiptFileId || null, receipt_file_name: purchase.receiptFileName || null,
      receipt_url: purchase.receiptUrl || null, receipt_uploaded_at: purchase.receiptUploadedAt || null,
      created_at: purchase.createdAt || new Date().toISOString(), cancelled_at: purchase.cancelledAt || null,
      updated_at: new Date().toISOString(), data: cleanData
    };
  }

  function rowToPurchaseItem(row) {
    const extra = row?.data && typeof row.data === 'object' ? row.data : {};
    return { ...extra, id: row.id, productId: row.product_id || extra.productId || '',
      code: row.code || extra.code || '', name: row.name || extra.name || 'Item',
      qty: Number(row.qty || 0), unitCost: Number(row.unit_cost || 0), previousCost: Number(row.previous_cost || 0) };
  }

  function purchaseItemToRow(item, purchaseId) {
    return { id: String(item.id), purchase_id: String(purchaseId), product_id: item.productId || null,
      code: item.code || null, name: item.name || 'Item', qty: Number(item.qty || 0),
      unit_cost: Number(item.unitCost || 0), previous_cost: Number(item.previousCost || 0), data: item };
  }

  async function fetchProducts() {
    const { data, error } = await getClient().from('products').select('*').order('name', { ascending: true });
    if (error) throw new Error('Produtos: ' + error.message);
    return (data || []).map(rowToProduct);
  }

  async function fetchClients() {
    const { data, error } = await getClient().from('clients').select('*').order('name', { ascending: true });
    if (error) throw new Error('Clientes: ' + error.message);
    return (data || []).map(rowToClient);
  }


  async function fetchSuppliers() {
    const { data, error } = await getClient().from('suppliers').select('*').order('name', { ascending: true });
    if (error) throw new Error('Fornecedores: ' + error.message);
    return (data || []).map(rowToSupplier);
  }


  async function fetchQuotes() {
    const sb = getClient();
    const [{ data: quoteRows, error: quoteError }, { data: itemRows, error: itemError }] = await Promise.all([
      sb.from('quotes').select('*').order('date', { ascending: false }),
      sb.from('quote_items').select('*')
    ]);
    if (quoteError) throw new Error('Orçamentos: ' + quoteError.message);
    if (itemError) throw new Error('Itens dos orçamentos: ' + itemError.message);

    const byQuote = new Map();
    (itemRows || []).forEach(row => {
      const key = String(row.quote_id || '');
      if (!byQuote.has(key)) byQuote.set(key, []);
      byQuote.get(key).push(rowToQuoteItem(row));
    });

    return (quoteRows || []).map(row => rowToQuote(row, byQuote.get(String(row.id)) || []));
  }

  async function fetchSales() {
    const sb = getClient();
    const [{ data: saleRows, error: saleError }, { data: itemRows, error: itemError }] = await Promise.all([
      sb.from('sales').select('*').order('date', { ascending: false }),
      sb.from('sale_items').select('*')
    ]);
    if (saleError) throw new Error('Vendas: ' + saleError.message);
    if (itemError) throw new Error('Itens das vendas: ' + itemError.message);

    const bySale = new Map();
    (itemRows || []).forEach(row => {
      const key = String(row.sale_id || '');
      if (!bySale.has(key)) bySale.set(key, []);
      bySale.get(key).push(rowToSaleItem(row));
    });
    return (saleRows || []).map(row => rowToSale(row, bySale.get(String(row.id)) || []));
  }

  async function fetchPurchases() {
    const sb = getClient();
    const [{ data: purchaseRows, error: purchaseError }, { data: itemRows, error: itemError }] = await Promise.all([
      sb.from('purchases').select('*').order('date', { ascending: false }),
      sb.from('purchase_items').select('*')
    ]);
    if (purchaseError) throw new Error('Compras: ' + purchaseError.message);
    if (itemError) throw new Error('Itens das compras: ' + itemError.message);
    const byPurchase = new Map();
    (itemRows || []).forEach(row => { const key=String(row.purchase_id||''); if(!byPurchase.has(key)) byPurchase.set(key,[]); byPurchase.get(key).push(rowToPurchaseItem(row)); });
    return (purchaseRows || []).map(row => rowToPurchase(row, byPurchase.get(String(row.id)) || []));
  }

  async function refreshPurchasesContext() {
    const [products, suppliers, purchases] = await Promise.all([fetchProducts(), fetchSuppliers(), fetchPurchases()]);
    localStorage.setItem('mj_products', JSON.stringify(products));
    localStorage.setItem('mj_suppliers', JSON.stringify(suppliers));
    localStorage.setItem('mj_purchases', JSON.stringify(purchases));
    return { ok:true, products, suppliers, purchases };
  }

  async function refreshSalesContext() {
    const [products, clients, sales] = await Promise.all([
      fetchProducts(), fetchClients(), fetchSales()
    ]);

    localStorage.setItem('mj_products', JSON.stringify(products));
    localStorage.setItem('mj_clients', JSON.stringify(clients));
    localStorage.setItem('mj_sales', JSON.stringify(sales));

    return {
      ok: true,
      products,
      clients,
      sales
    };
  }

  async function bootstrap() {
    window.MJAppLoader?.set?.('loading', 'Conectando ao PostgreSQL...', 25);
    try {
      const [products, clients, suppliers, quotes, sales, purchases] = await Promise.all([
        fetchProducts(), fetchClients(), fetchSuppliers(), fetchQuotes(), fetchSales(), fetchPurchases()
      ]);
      window.MJAppLoader?.set?.('loading', 'Produtos, clientes, fornecedores, orçamentos e vendas recebidos do Supabase...', 62);

      localStorage.setItem('mj_products', JSON.stringify(products));
      localStorage.setItem('mj_clients', JSON.stringify(clients));
      localStorage.setItem('mj_suppliers', JSON.stringify(suppliers));
      localStorage.setItem('mj_quotes', JSON.stringify(quotes));
      localStorage.setItem('mj_sales', JSON.stringify(sales));
      localStorage.setItem('mj_purchases', JSON.stringify(purchases));

      // Fase de teste isolada: módulos ainda não migrados ficam vazios nesta cópia.
      const emptyKeys = [
        'mj_financial_transactions','mj_expenses','mj_infinitepay_transactions'
      ];
      emptyKeys.forEach(k => localStorage.setItem(k, '[]'));
      localStorage.setItem('mj_infinitepay_config', '{}');

      return {
        connected: true,
        provider: 'supabase',
        data: {
          mj_products: products,
          mj_clients: clients,
          mj_suppliers: suppliers,
          mj_quotes: quotes,
          mj_sales: sales,
          mj_purchases: purchases,
          mj_current_user: currentUser
        }
      };
    } catch (error) {
      console.error('[MJ Supabase] Bootstrap:', error);
      return { connected: false, error };
    }
  }

  async function saveProduct(product) {
    const row = productToRow(product);
    const { data, error } = await getClient()
      .from('products')
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) throw new Error('Não foi possível salvar o produto: ' + error.message);
    return { ok: true, data: rowToProduct(data) };
  }

  async function deleteProduct(id) {
    const { error } = await getClient().from('products').delete().eq('id', String(id));
    if (error) throw new Error('Não foi possível excluir o produto: ' + error.message);
    return { ok: true, data: { id: String(id) } };
  }

  async function syncProducts(list) {
    const rows = Array.isArray(list) ? list.map(productToRow) : [];
    if (!rows.length) return { ok: true, data: list || [] };
    const { error } = await getClient().from('products').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error('Não foi possível atualizar o estoque dos produtos: ' + error.message);
    return { ok: true, data: list };
  }

  function isStockTrackedProduct(product) {
    if (!product) return false;
    if (String(product.category || '').toLowerCase() === 'serviços') return false;
    return !(Number(product.minStock || 0) === 0 && Number(product.stock || 0) === 0);
  }

  function saleMovementRows(sale) {
    const when = sale.createdAt || new Date().toISOString();
    return (Array.isArray(sale.items) ? sale.items : [])
      .filter(item => item.productId)
      .map(item => ({
        id: `sale:${sale.id}:${item.id}:out`,
        date: when,
        product_id: String(item.productId),
        type: 'Saída',
        qty: Number(item.qty || 0),
        source: 'Venda',
        source_id: String(sale.id),
        notes: sale.num ? `Saída automática da venda ${sale.num}` : 'Saída automática de venda',
        data: { saleId: sale.id, saleNumber: sale.num || '', item }
      }));
  }

  async function registerSaleMovements(sale) {
    if (!sale?.id) return;
    const rows = saleMovementRows(sale);
    if (!rows.length) return;
    const { error } = await getClient().from('stock_movements').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error('Não foi possível registrar a movimentação de estoque: ' + error.message);
  }

  async function syncClients(list) {
    const rows = Array.isArray(list) ? list.map(clientToRow) : [];
    const sb = getClient();

    if (rows.length) {
      const { error: upsertError } = await sb.from('clients').upsert(rows, { onConflict: 'id' });
      if (upsertError) throw new Error('Não foi possível sincronizar clientes: ' + upsertError.message);
    }

    const ids = rows.map(r => r.id);
    const { data: existing, error: listError } = await sb.from('clients').select('id');
    if (listError) throw new Error('Não foi possível validar clientes: ' + listError.message);
    const removeIds = (existing || []).map(r => r.id).filter(id => !ids.includes(id));
    if (removeIds.length) {
      const { error: deleteError } = await sb.from('clients').delete().in('id', removeIds);
      if (deleteError) throw new Error('Não foi possível remover clientes: ' + deleteError.message);
    }
    return { ok: true, data: list };
  }

  async function syncSuppliers(list) {
    const rows = Array.isArray(list) ? list.map(supplierToRow) : [];
    const sb = getClient();

    if (rows.length) {
      const { error: upsertError } = await sb.from('suppliers').upsert(rows, { onConflict: 'id' });
      if (upsertError) throw new Error('Não foi possível sincronizar fornecedores: ' + upsertError.message);
    }

    const ids = rows.map(r => r.id);
    const { data: existing, error: listError } = await sb.from('suppliers').select('id');
    if (listError) throw new Error('Não foi possível validar fornecedores: ' + listError.message);
    const removeIds = (existing || []).map(r => r.id).filter(id => !ids.includes(id));
    if (removeIds.length) {
      const { error: deleteError } = await sb.from('suppliers').delete().in('id', removeIds);
      if (deleteError) throw new Error('Não foi possível remover fornecedores: ' + deleteError.message);
    }
    return { ok: true, data: list };
  }


  async function replaceQuoteItems(quoteId, items) {
    const sb = getClient();
    const { error: deleteError } = await sb.from('quote_items').delete().eq('quote_id', String(quoteId));
    if (deleteError) throw new Error('Não foi possível atualizar os itens do orçamento: ' + deleteError.message);

    const rows = (Array.isArray(items) ? items : []).map(item => quoteItemToRow(item, quoteId));
    if (rows.length) {
      const { error: insertError } = await sb.from('quote_items').insert(rows);
      if (insertError) throw new Error('Não foi possível salvar os itens do orçamento: ' + insertError.message);
    }
  }

  async function saveQuote(quote) {
    const sb = getClient();
    const row = quoteToRow(quote);
    const { data, error } = await sb.from('quotes').upsert(row, { onConflict: 'id' }).select('*').single();
    if (error) throw new Error('Não foi possível salvar o orçamento: ' + error.message);
    await replaceQuoteItems(quote.id, quote.items || []);
    const items = (quote.items || []).map(item => ({ ...item }));
    return { ok: true, data: rowToQuote(data, items) };
  }

  async function deleteQuote(id) {
    const { error } = await getClient().from('quotes').delete().eq('id', String(id));
    if (error) throw new Error('Não foi possível excluir o orçamento: ' + error.message);
    return { ok: true, data: { id: String(id) } };
  }

  async function convertQuote(id, saleId = '') {
    const convertedAt = new Date().toISOString();
    const { data, error } = await getClient()
      .from('quotes')
      .update({ status: 'Convertido', converted_at: convertedAt, sale_id: saleId || null, updated_at: convertedAt })
      .eq('id', String(id))
      .select('*')
      .single();
    if (error) throw new Error('Não foi possível converter o orçamento: ' + error.message);
    return { ok: true, data };
  }

  async function syncQuotes(list) {
    const quotesList = Array.isArray(list) ? list : [];
    const sb = getClient();
    const rows = quotesList.map(quoteToRow);

    if (rows.length) {
      const { error: upsertError } = await sb.from('quotes').upsert(rows, { onConflict: 'id' });
      if (upsertError) throw new Error('Não foi possível sincronizar orçamentos: ' + upsertError.message);
    }

    const ids = rows.map(r => r.id);
    const { data: existing, error: listError } = await sb.from('quotes').select('id');
    if (listError) throw new Error('Não foi possível validar orçamentos: ' + listError.message);
    const removeIds = (existing || []).map(r => String(r.id)).filter(id => !ids.includes(id));
    if (removeIds.length) {
      const { error: deleteError } = await sb.from('quotes').delete().in('id', removeIds);
      if (deleteError) throw new Error('Não foi possível remover orçamentos: ' + deleteError.message);
    }

    // Espelha os itens de cada orçamento. A exclusão anterior evita itens antigos após uma edição.
    for (const quote of quotesList) {
      await replaceQuoteItems(quote.id, quote.items || []);
    }

    return { ok: true, data: list };
  }

  async function replaceSaleItems(saleId, items) {
    const sb = getClient();
    const { error: deleteError } = await sb.from('sale_items').delete().eq('sale_id', String(saleId));
    if (deleteError) throw new Error('Não foi possível atualizar os itens da venda: ' + deleteError.message);
    const rows = (Array.isArray(items) ? items : []).map(item => saleItemToRow(item, saleId));
    if (rows.length) {
      const { error: insertError } = await sb.from('sale_items').insert(rows);
      if (insertError) throw new Error('Não foi possível salvar os itens da venda: ' + insertError.message);
    }
  }

  async function syncSales(list) {
    const salesList = Array.isArray(list) ? list : [];
    const sb = getClient();
    const rows = salesList.map(saleToRow);
    if (rows.length) {
      const { error: upsertError } = await sb.from('sales').upsert(rows, { onConflict: 'id' });
      if (upsertError) throw new Error('Não foi possível sincronizar vendas: ' + upsertError.message);
    }
    const ids = rows.map(r => r.id);
    const { data: existing, error: listError } = await sb.from('sales').select('id');
    if (listError) throw new Error('Não foi possível validar vendas: ' + listError.message);
    const removeIds = (existing || []).map(r => String(r.id)).filter(id => !ids.includes(id));
    if (removeIds.length) {
      const { error: deleteError } = await sb.from('sales').delete().in('id', removeIds);
      if (deleteError) throw new Error('Não foi possível remover vendas: ' + deleteError.message);
    }
    for (const sale of salesList) {
      await replaceSaleItems(sale.id, sale.items || []);
      if (String(sale.status || '').toLowerCase() !== 'cancelado') await registerSaleMovements(sale);
    }
    return { ok: true, data: list };
  }

  async function finalizeSale(sale) {
    const sb = getClient();
    const row = saleToRow(sale);
    const { data, error } = await sb.from('sales').upsert(row, { onConflict: 'id' }).select('*').single();
    if (error) throw new Error('Não foi possível salvar a venda: ' + error.message);
    await replaceSaleItems(sale.id, sale.items || []);
    await registerSaleMovements(sale);
    if (sale.sourceQuoteId) await convertQuote(sale.sourceQuoteId, sale.id);
    return { ok: true, data: { venda: rowToSale(data, (sale.items || []).map(i => ({ ...i }))) } };
  }

  async function cancelSale(id) {
    const sb = getClient();
    const saleId = String(id);
    const cancelledAt = new Date().toISOString();

    const { data: currentSale, error: currentError } = await sb.from('sales').select('*').eq('id', saleId).single();
    if (currentError) throw new Error('Não foi possível localizar a venda: ' + currentError.message);

    const { data: itemRows, error: itemError } = await sb.from('sale_items').select('*').eq('sale_id', saleId);
    if (itemError) throw new Error('Não foi possível carregar os itens da venda cancelada: ' + itemError.message);
    const items = (itemRows || []).map(rowToSaleItem);

    // Se já estiver cancelada, não devolve estoque uma segunda vez.
    if (String(currentSale?.status || '').toLowerCase() === 'cancelado') {
      const products = await fetchProducts();
      return { ok: true, data: { venda: rowToSale(currentSale, items), products } };
    }

    const productIds = [...new Set(items.map(i => i.productId).filter(Boolean).map(String))];
    let productRows = [];
    if (productIds.length) {
      const { data, error } = await sb.from('products').select('*').in('id', productIds);
      if (error) throw new Error('Não foi possível carregar o estoque atual: ' + error.message);
      productRows = data || [];
    }

    const byProduct = new Map(productRows.map(row => [String(row.id), row]));
    const changedRows = [];
    const movementRows = [];
    for (const item of items) {
      const row = byProduct.get(String(item.productId || ''));
      if (!row) continue;
      const product = rowToProduct(row);
      if (!isStockTrackedProduct(product)) continue;
      const qty = Number(item.qty || 0);
      row.stock = Number(row.stock || 0) + qty;
      row.updated_at = cancelledAt;
      const extra = row.data && typeof row.data === 'object' ? { ...row.data } : {};
      extra.stock = Number(row.stock || 0);
      extra.updatedAt = cancelledAt;
      row.data = extra;
      changedRows.push(row);
      movementRows.push({
        id: `sale-cancel:${saleId}:${item.id}:in`,
        date: cancelledAt,
        product_id: String(item.productId),
        type: 'Entrada',
        qty,
        source: 'Cancelamento de Venda',
        source_id: saleId,
        notes: currentSale?.num ? `Estorno automático da venda ${currentSale.num}` : 'Estorno automático de venda',
        data: { saleId, saleNumber: currentSale?.num || '', item }
      });
    }

    if (changedRows.length) {
      const { error } = await sb.from('products').upsert(changedRows, { onConflict: 'id' });
      if (error) throw new Error('Não foi possível devolver os itens ao estoque: ' + error.message);
    }
    if (movementRows.length) {
      const { error } = await sb.from('stock_movements').upsert(movementRows, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new Error('Não foi possível registrar o estorno de estoque: ' + error.message);
    }

    const { data, error } = await sb.from('sales')
      .update({ status: 'Cancelado', cancelled_at: cancelledAt, updated_at: cancelledAt })
      .eq('id', saleId).select('*').single();
    if (error) throw new Error('Não foi possível cancelar a venda: ' + error.message);

    const products = await fetchProducts();
    return { ok: true, data: { venda: rowToSale(data, items), products } };
  }

  async function replacePurchaseItems(purchaseId, items) {
    const sb=getClient();
    const {error:del}=await sb.from('purchase_items').delete().eq('purchase_id',String(purchaseId));
    if(del) throw new Error('Não foi possível atualizar os itens da compra: '+del.message);
    const rows=(Array.isArray(items)?items:[]).map(i=>purchaseItemToRow(i,purchaseId));
    if(rows.length){ const {error}=await sb.from('purchase_items').insert(rows); if(error) throw new Error('Não foi possível salvar os itens da compra: '+error.message); }
  }

  async function finalizePurchase(purchase) {
    const sb=getClient();
    if(!purchase?.id || !(purchase.items||[]).length) throw new Error('A compra precisa ter ao menos um item.');
    const ids=[...new Set((purchase.items||[]).map(i=>String(i.productId||'')).filter(Boolean))];
    const {data:rows,error:pe}=await sb.from('products').select('*').in('id',ids);
    if(pe) throw new Error('Não foi possível carregar os produtos: '+pe.message);
    const map=new Map((rows||[]).map(r=>[String(r.id),r]));
    const changed=[], moves=[], normalized=[]; const now=new Date().toISOString();
    for(const item of purchase.items||[]){
      const row=map.get(String(item.productId||'')); if(!row) throw new Error('Produto não encontrado: '+(item.name||item.productId||''));
      const product=rowToProduct(row), qty=Number(item.qty||0), cost=Number(item.unitCost||0);
      if(qty<=0) throw new Error('Quantidade inválida para '+product.name+'.');
      const ni={...item,productId:product.id,code:product.code||'',name:product.name||item.name||'',qty,unitCost:cost,previousCost:Number(product.cost||0)}; normalized.push(ni);
      // Compra transforma qualquer produto físico em item de estoque, mesmo quando
      // ele foi cadastrado inicialmente com estoque 0 e mínimo 0. Serviços não movimentam estoque.
      if(String(product.category || '').toLowerCase() !== 'serviços'){
        row.stock=Number(row.stock||0)+qty;
        moves.push({id:`purchase:${purchase.id}:${item.id}:in`,date:purchase.date||now,product_id:String(product.id),type:'Entrada',qty,source:'Compra',source_id:String(purchase.id),notes:`Entrada automática da compra ${purchase.num||''}`,data:{purchaseId:purchase.id,purchaseNumber:purchase.num||'',item:ni}});
      }
      if(purchase.updateCost!==false) row.cost=cost;
      row.updated_at=now; row.data={...(row.data||{}),stock:Number(row.stock||0),cost:Number(row.cost||0),updatedAt:now}; changed.push(row);
    }
    const savedPurchase={...purchase,items:normalized,updatedAt:now};
    const {data,error}=await sb.from('purchases').upsert(purchaseToRow(savedPurchase),{onConflict:'id'}).select('*').single();
    if(error) throw new Error('Não foi possível salvar a compra: '+error.message);
    await replacePurchaseItems(purchase.id,normalized);
    if(changed.length){const {error}=await sb.from('products').upsert(changed,{onConflict:'id'});if(error)throw new Error('Não foi possível atualizar o estoque: '+error.message);}
    if(moves.length){const {error}=await sb.from('stock_movements').upsert(moves,{onConflict:'id',ignoreDuplicates:true});if(error)throw new Error('Não foi possível registrar a entrada de estoque: '+error.message);}
    const products=await fetchProducts();
    return {ok:true,data:{compra:rowToPurchase(data,normalized),products}};
  }

  async function cancelPurchase(id) {
    const sb=getClient(), purchaseId=String(id), now=new Date().toISOString();
    const {data:pr,error:pre}=await sb.from('purchases').select('*').eq('id',purchaseId).single(); if(pre) throw new Error('Não foi possível localizar a compra: '+pre.message);
    const {data:irs,error:ire}=await sb.from('purchase_items').select('*').eq('purchase_id',purchaseId); if(ire) throw new Error('Não foi possível carregar os itens da compra: '+ire.message);
    const items=(irs||[]).map(rowToPurchaseItem);
    if(String(pr.status||'').toLowerCase()==='cancelada') return {ok:true,data:{compra:rowToPurchase(pr,items),products:await fetchProducts()}};
    const ids=[...new Set(items.map(i=>String(i.productId||'')).filter(Boolean))]; const {data:rows,error:pe}=await sb.from('products').select('*').in('id',ids); if(pe)throw new Error('Não foi possível carregar o estoque atual: '+pe.message);
    const map=new Map((rows||[]).map(r=>[String(r.id),r])); const changed=[],moves=[];
    for(const item of items){const row=map.get(String(item.productId||''));if(!row)continue;const product=rowToProduct(row);if(!isStockTrackedProduct(product))continue;const qty=Number(item.qty||0);if(Number(row.stock||0)<qty)throw new Error(`Não é possível cancelar: o estoque atual de ${product.name} é menor que a quantidade desta compra.`);row.stock=Number(row.stock||0)-qty;row.updated_at=now;row.data={...(row.data||{}),stock:Number(row.stock||0),updatedAt:now};changed.push(row);moves.push({id:`purchase-cancel:${purchaseId}:${item.id}:out`,date:now,product_id:String(item.productId),type:'Saída',qty,source:'Cancelamento de Compra',source_id:purchaseId,notes:`Estorno automático da compra ${pr.num||''}`,data:{purchaseId,item}});}
    if(changed.length){const {error}=await sb.from('products').upsert(changed,{onConflict:'id'});if(error)throw new Error('Não foi possível estornar o estoque: '+error.message);}
    if(moves.length){const {error}=await sb.from('stock_movements').upsert(moves,{onConflict:'id',ignoreDuplicates:true});if(error)throw new Error('Não foi possível registrar o estorno: '+error.message);}
    const {data,error}=await sb.from('purchases').update({status:'Cancelada',cancelled_at:now,updated_at:now}).eq('id',purchaseId).select('*').single();if(error)throw new Error('Não foi possível cancelar a compra: '+error.message);
    return {ok:true,data:{compra:rowToPurchase(data,items),products:await fetchProducts()}};
  }

  async function pushKey(keyName, data) {
    if (keyName === 'mj_products') return syncProducts(data);
    if (keyName === 'mj_clients') return syncClients(data);
    if (keyName === 'mj_suppliers') return syncSuppliers(data);
    if (keyName === 'mj_quotes') return syncQuotes(data);
    if (keyName === 'mj_sales') return syncSales(data);
    if (keyName === 'mj_purchases') return { ok:true, skipped:true, message:'Compras usam rotinas próprias no Supabase.' };
    // Produtos, Clientes, Fornecedores, Orçamentos e Vendas usam sincronização própria.
    return { ok: true, skipped: true, message: `Chave ${keyName} ainda não migrada para Supabase.` };
  }

  async function logout() {
    const loader = document.getElementById('appLoadingOverlay');
    const title = document.getElementById('appLoadingTitle');
    const message = document.getElementById('appLoadingMessage');
    const hint = document.getElementById('appLoadingHint');
    if (loader) { loader.classList.remove('is-hidden'); loader.setAttribute('aria-busy', 'true'); }
    if (title) title.textContent = 'Saindo do sistema...';
    if (message) message.textContent = 'Encerrando sua sessão do Supabase.';
    if (hint) hint.textContent = 'Aguarde alguns instantes.';

    try { await getClient().auth.signOut(); } catch (err) { console.warn('[MJ Supabase] Logout:', err); }
    currentUser = null;
    loginPromise = null;
    clearLoginFields();
    try { sessionStorage.removeItem('mj_active_view'); } catch (_) {}
    location.reload();
  }

  async function request(action) {
    if (action === 'ping') {
      return { ok: true, version: '12.0.7', provider: 'supabase', database: 'PostgreSQL' };
    }
    throw new Error(`A rotina ${action} ainda não foi migrada para Supabase nesta fase de teste.`);
  }

  function notMigrated(name) {
    return async () => { throw new Error(`A rotina ${name} ainda não foi migrada para Supabase. Nesta fase teste apenas os módulos já migrados para Supabase.`); };
  }

  window.MJCloud = {
    init,
    bootstrap,
    refreshSalesContext,
    refreshPurchasesContext,
    DATA_KEYS,
    getCurrentUser: () => currentUser,
    getToken: () => '',
    getConfig: () => ({ enabled: true, provider: 'supabase', url }),
    request,
    syncAll: notMigrated('syncAll'),
    pushKey,
    logout,

    saveProduct,
    deleteProduct,
    saveQuote,
    deleteQuote,
    convertQuote,
    sendQuoteEmail: notMigrated('enviarOrcamentoEmail'),
    finalizeSale,
    cancelSale,
    saveFinancial: notMigrated('salvarFinanceiro'),
    markFinancialPaid: notMigrated('marcarFinanceiroPago'),
    saveExpense: notMigrated('salvarDespesa'),
    deleteExpense: notMigrated('excluirDespesa'),
    markExpensePaid: notMigrated('marcarDespesaPaga'),
    finalizePurchase,
    cancelPurchase,
    uploadReceipt: notMigrated('anexarComprovante'),
    getReceipt: notMigrated('obterComprovante'),
    listUsers: notMigrated('listarUsuarios'),
    saveUser: notMigrated('salvarUsuario'),
    deleteUser: notMigrated('excluirUsuario'),
    changeMyPassword: notMigrated('alterarMinhaSenha'),
    getAuditLogs: () => auditCache.slice(),
    listAudit: notMigrated('listarAuditoria')
  };
})();
