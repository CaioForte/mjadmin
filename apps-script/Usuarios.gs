/** MJ ADMIN V11.24 - Usuários, login, sessões e configuração inicial */
const MJ_SESSION_TTL = 21600; // 6 horas
const MJ_SESSION_PREFIX = 'MJ_SESSION_';

const MJ_PERMISSIONS = [
  'dashboard','nova-venda','vendas','orcamentos','produtos','clientes',
  'fornecedores','compras','estoque','financeiro','despesas','relatorios',
  'configuracoes','usuarios','auditoria'
];

function permissoesPadraoPerfil_(role) {
  const perfil = String(role || '').trim();
  if (perfil === 'Administrador') return MJ_PERMISSIONS.slice();
  if (perfil === 'Gerente') return [
    'dashboard','nova-venda','vendas','orcamentos','produtos','clientes',
    'fornecedores','compras','estoque','financeiro','despesas','relatorios','configuracoes'
  ];
  if (perfil === 'Vendedor') return ['dashboard','nova-venda','vendas','orcamentos','clientes','produtos'];
  if (perfil === 'Financeiro') return ['dashboard','vendas','compras','financeiro','despesas','relatorios','clientes','fornecedores'];
  if (perfil === 'Estoque') return ['dashboard','produtos','fornecedores','compras','estoque'];
  return ['dashboard'];
}

function normalizarEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function gerarSalt_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function hashSenha_(senha, salt) {
  const raw = String(salt || '') + '|' + String(senha || '');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return digest.map(function(b){ const v = b < 0 ? b + 256 : b; return ('0' + v.toString(16)).slice(-2); }).join('');
}

function usuarioPublico_(user) {
  const u = Object.assign({}, user || {});
  delete u.passwordHash;
  delete u.passwordSalt;
  u.permissions = Array.isArray(u.permissions) ? u.permissions : permissoesPadraoPerfil_(u.role);
  return u;
}

function temPermissao_(user, permission) {
  if (!user) return false;
  if (String(user.role) === 'Administrador') return true;
  const perms = Array.isArray(user.permissions) ? user.permissions : permissoesPadraoPerfil_(user.role);
  return perms.indexOf(permission) >= 0;
}

function criarSessao_(user) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  const data = { userId: user.id, email: user.email, issuedAt: nowIso_() };
  CacheService.getScriptCache().put(MJ_SESSION_PREFIX + token, JSON.stringify(data), MJ_SESSION_TTL);
  return token;
}

function validarSessao_(token, renovar) {
  token = String(token || '').trim();
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const raw = cache.get(MJ_SESSION_PREFIX + token);
  if (!raw) return null;
  let session;
  try { session = JSON.parse(raw); } catch (_) { return null; }
  const users = readObjects_('Usuarios');
  const user = users.find(function(u){ return String(u.id || '') === String(session.userId || ''); });
  if (!user || String(user.status || 'Ativo') !== 'Ativo') {
    cache.remove(MJ_SESSION_PREFIX + token);
    return null;
  }
  if (renovar !== false) cache.put(MJ_SESSION_PREFIX + token, raw, MJ_SESSION_TTL);
  return user;
}

function loginUsuario_(email, senha) {
  const normalized = normalizarEmail_(email);
  if (!normalized || !senha) throw new Error('Informe e-mail e senha.');
  const users = readObjects_('Usuarios');
  if (!users.length) throw new Error('Nenhum administrador foi configurado. Faça a configuração inicial pelo MJ Admin.');
  const user = users.find(function(u){ return normalizarEmail_(u.email) === normalized; });
  if (!user || String(user.status || 'Ativo') !== 'Ativo') throw new Error('Usuário ou senha inválidos.');
  const expected = hashSenha_(senha, user.passwordSalt || '');
  if (!user.passwordHash || expected !== String(user.passwordHash)) throw new Error('Usuário ou senha inválidos.');
  user.lastLoginAt = nowIso_();
  upsertObject_('Usuarios', user);
  const token = criarSessao_(user);
  setAuditActor_(user);
  log_('login', user.id, user.email);
  return { token: token, user: usuarioPublico_(user), expiresIn: MJ_SESSION_TTL };
}

function logoutUsuario_(token) {
  if (token) CacheService.getScriptCache().remove(MJ_SESSION_PREFIX + String(token));
  return true;
}

function listarUsuarios_() {
  return readObjects_('Usuarios').map(usuarioPublico_).sort(function(a,b){ return String(a.name||'').localeCompare(String(b.name||''),'pt-BR'); });
}

function salvarUsuario_(payload, actor) {
  payload = payload || {};
  const users = readObjects_('Usuarios');
  const id = String(payload.id || '').trim();
  const existing = id ? users.find(function(u){ return String(u.id) === id; }) : null;
  const email = normalizarEmail_(payload.email || (existing && existing.email));
  const name = String(payload.name || (existing && existing.name) || '').trim();
  const role = String(payload.role || (existing && existing.role) || 'Vendedor').trim();
  const status = String(payload.status || (existing && existing.status) || 'Ativo').trim();
  if (!name) throw new Error('Informe o nome do usuário.');
  if (!email || email.indexOf('@') < 1) throw new Error('Informe um e-mail válido.');
  if (users.some(function(u){ return String(u.id)!==id && normalizarEmail_(u.email)===email; })) throw new Error('Já existe um usuário com este e-mail.');

  const permissions = Array.isArray(payload.permissions) && payload.permissions.length
    ? payload.permissions.filter(function(p){ return MJ_PERMISSIONS.indexOf(p)>=0; })
    : permissoesPadraoPerfil_(role);

  const user = Object.assign({}, existing || {}, {
    id: id || uid_('usr'), name: name, email: email, role: role, status: status,
    permissions: permissions,
    createdAt: (existing && existing.createdAt) || nowIso_(),
    updatedAt: nowIso_()
  });

  const senha = String(payload.password || '');
  if (!existing && senha.length < 6) throw new Error('A senha inicial deve ter pelo menos 6 caracteres.');
  if (senha) {
    if (senha.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
    user.passwordSalt = gerarSalt_();
    user.passwordHash = hashSenha_(senha, user.passwordSalt);
  }

  // Impede desativar ou rebaixar o último administrador ativo.
  if (existing && String(existing.role)==='Administrador' && (role!=='Administrador' || status!=='Ativo')) {
    const otherAdmins = users.filter(function(u){ return String(u.id)!==id && String(u.role)==='Administrador' && String(u.status||'Ativo')==='Ativo'; });
    if (!otherAdmins.length) throw new Error('Não é possível remover ou desativar o último administrador ativo.');
  }

  upsertObject_('Usuarios', user);
  log_('salvarUsuario', user.id, user.name + ' • ' + user.email);
  return usuarioPublico_(user);
}

function excluirUsuario_(id, actor) {
  id = String(id || '');
  const users = readObjects_('Usuarios');
  const user = users.find(function(u){ return String(u.id)===id; });
  if (!user) throw new Error('Usuário não encontrado.');
  if (actor && String(actor.id)===id) throw new Error('Você não pode excluir seu próprio usuário enquanto está conectado.');
  if (String(user.role)==='Administrador') {
    const otherAdmins = users.filter(function(u){ return String(u.id)!==id && String(u.role)==='Administrador' && String(u.status||'Ativo')==='Ativo'; });
    if (!otherAdmins.length) throw new Error('Não é possível excluir o último administrador ativo.');
  }
  deleteObject_('Usuarios', id);
  log_('excluirUsuario', id, user.name + ' • ' + user.email);
  return true;
}

function alterarSenhaPropria_(user, senhaAtual, novaSenha) {
  if (!user) throw new Error('Sessão inválida.');
  if (String(novaSenha || '').length < 6) throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
  const expected = hashSenha_(senhaAtual || '', user.passwordSalt || '');
  if (!user.passwordHash || expected !== String(user.passwordHash)) throw new Error('Senha atual incorreta.');
  user.passwordSalt = gerarSalt_();
  user.passwordHash = hashSenha_(novaSenha, user.passwordSalt);
  user.updatedAt = nowIso_();
  upsertObject_('Usuarios', user);
  log_('alterarSenha', user.id, user.email);
  return true;
}

function verificarConfiguracaoInicial_() {
  setupDatabase_();
  const users = readObjects_('Usuarios');
  const adminAtivo = users.some(function(u){
    return String(u.role || '') === 'Administrador' && String(u.status || 'Ativo') === 'Ativo';
  });
  return {
    configurado: adminAtivo,
    precisaAdministrador: !adminAtivo
  };
}

function criarAdministradorInicial_(payload) {
  setupDatabase_();
  payload = payload || {};

  const users = readObjects_('Usuarios');
  const adminAtivo = users.some(function(u){
    return String(u.role || '') === 'Administrador' && String(u.status || 'Ativo') === 'Ativo';
  });
  if (adminAtivo) {
    throw new Error('A configuração inicial já foi concluída. Entre com seu usuário administrador.');
  }

  const name = String(payload.name || payload.nome || '').trim();
  const email = normalizarEmail_(payload.email);
  const password = String(payload.password || payload.senha || '');
  const confirmPassword = String(payload.confirmPassword || payload.confirmarSenha || '');

  if (!name) throw new Error('Informe o nome do administrador.');
  if (!email || email.indexOf('@') < 1) throw new Error('Informe um e-mail válido.');
  if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
  if (confirmPassword && password !== confirmPassword) throw new Error('A confirmação da senha não confere.');
  if (users.some(function(u){ return normalizarEmail_(u.email) === email; })) {
    throw new Error('Já existe um usuário cadastrado com este e-mail.');
  }

  const salt = gerarSalt_();
  const user = {
    id: uid_('usr'),
    name: name,
    email: email,
    role: 'Administrador',
    status: 'Ativo',
    permissions: MJ_PERMISSIONS.slice(),
    passwordSalt: salt,
    passwordHash: hashSenha_(password, salt),
    createdAt: nowIso_(),
    updatedAt: nowIso_(),
    lastLoginAt: nowIso_()
  };

  upsertObject_('Usuarios', user);
  const token = criarSessao_(user);
  setAuditActor_(user);
  log_('criarAdministradorInicial', user.id, user.email);

  return {
    created: true,
    token: token,
    user: usuarioPublico_(user),
    expiresIn: MJ_SESSION_TTL
  };
}

// Compatibilidade: não usa mais prompts do editor.
function configurarAdministradorInicial() {
  const status = verificarConfiguracaoInicial_();
  if (status.configurado) return 'O MJ Admin já possui um administrador ativo.';
  return 'Abra o MJ Admin e conclua a Configuração Inicial pela tela de acesso.';
}

function permissaoParaSyncKey_(key) {
  const map = {
    mj_products:'produtos', mj_clients:'clientes', mj_suppliers:'fornecedores', mj_quotes:'orcamentos',
    mj_sales:'vendas', mj_purchases:'compras', mj_financial_transactions:'financeiro', mj_expenses:'despesas',
    mj_infinitepay_config:'configuracoes', mj_infinitepay_transactions:'configuracoes'
  };
  return map[String(key||'')] || '';
}

function permissaoParaAcao_(body) {
  const action = String((body && body.action) || '');
  const fixed = {
    salvarProduto:'produtos', excluirProduto:'produtos',
    salvarOrcamento:'orcamentos', excluirOrcamento:'orcamentos', converterOrcamento:'orcamentos', enviarOrcamentoEmail:'orcamentos',
    finalizarVenda:'nova-venda', cancelarVenda:'vendas',
    finalizarCompra:'compras', cancelarCompra:'compras',
    salvarFinanceiro:'financeiro', marcarFinanceiroPago:'financeiro',
    salvarDespesa:'despesas', excluirDespesa:'despesas', marcarDespesaPaga:'despesas',
    listarUsuarios:'usuarios', salvarUsuario:'usuarios', excluirUsuario:'usuarios', listarAuditoria:'auditoria'
  };
  if (action === 'syncKey') return permissaoParaSyncKey_(body.key);
  if (action === 'syncAll') return 'usuarios';
  if (action === 'anexarComprovante' || action === 'obterComprovante') {
    return String(body.entityType || '').toLowerCase() === 'compra' ? 'compras' : 'vendas';
  }
  return fixed[action] || '';
}

function bootstrapDataUsuario_(user) {
  const all = bootstrapData_();
  const allowed = {
    mj_products: temPermissao_(user,'produtos') || temPermissao_(user,'estoque') || temPermissao_(user,'nova-venda') || temPermissao_(user,'orcamentos') || temPermissao_(user,'compras'),
    mj_clients: temPermissao_(user,'clientes') || temPermissao_(user,'nova-venda') || temPermissao_(user,'orcamentos'),
    mj_suppliers: temPermissao_(user,'fornecedores') || temPermissao_(user,'compras') || temPermissao_(user,'despesas'),
    mj_quotes: temPermissao_(user,'orcamentos'),
    mj_sales: temPermissao_(user,'vendas') || temPermissao_(user,'nova-venda') || temPermissao_(user,'relatorios'),
    mj_purchases: temPermissao_(user,'compras') || temPermissao_(user,'relatorios'),
    mj_financial_transactions: temPermissao_(user,'financeiro') || temPermissao_(user,'relatorios'),
    mj_expenses: temPermissao_(user,'despesas') || temPermissao_(user,'relatorios'),
    mj_infinitepay_config: false,
    mj_infinitepay_transactions: false
  };
  Object.keys(all).forEach(function(k){ if (!allowed[k]) all[k] = (k.indexOf('config')>=0 ? {} : []); });
  all.mj_current_user = usuarioPublico_(user);
  return all;
}
