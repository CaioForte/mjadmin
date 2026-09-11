/** MJ ADMIN V11.27.2 - Entrada da API com auditoria. */
function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'ping');
  return route_({ action: action, token: e && e.parameter ? e.parameter.token : '' });
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    return route_(body || {});
  } catch (err) {
    return json_({ ok: false, message: err.message, stack: String(err.stack || '') });
  }
}

function route_(body) {
  try {
    setupDatabase_();
    setAuditActor_(null);
    const action = String(body.action || '');

    // Rotas públicas.
    if (action === 'ping') {
      return json_({ ok: true, version: MJ_DB.version, spreadsheetName: getDb_().getName(), timestamp: nowIso_() });
    }
    if (action === 'statusConfiguracao') {
      return json_({ ok: true, data: verificarConfiguracaoInicial_() });
    }
    if (action === 'criarAdministradorInicial') {
      return json_({ ok: true, data: criarAdministradorInicial_(body || {}) });
    }
    if (action === 'login') {
      return json_({ ok: true, data: loginUsuario_(body.email || '', body.password || '') });
    }
    if (action === 'logout') {
      const logoutUser = validarSessao_(body.token || '', false);
      if (logoutUser) { setAuditActor_(logoutUser); log_('logout', logoutUser.id, logoutUser.email); }
      logoutUsuario_(body.token || '');
      return json_({ ok: true });
    }

    const user = validarSessao_(body.token || '');
    if (!user) {
      return json_({ ok: false, code: 'AUTH_REQUIRED', message: 'Sua sessão expirou. Faça login novamente.' });
    }

    if (action === 'sessao') {
      return json_({ ok: true, data: { user: usuarioPublico_(user), expiresIn: MJ_SESSION_TTL } });
    }

    setAuditActor_(user);

    const required = permissaoParaAcao_(body);
    if (required && !temPermissao_(user, required)) {
      return json_({ ok: false, code: 'FORBIDDEN', message: 'Seu usuário não possui permissão para realizar esta operação.' });
    }

    switch (action) {
      case 'bootstrap': return json_({ ok: true, version: MJ_DB.version, spreadsheetName: getDb_().getName(), data: bootstrapDataUsuario_(user) });
      case 'syncKey': syncKey_(String(body.key || ''), body.data); return json_({ ok: true, key: body.key, timestamp: nowIso_() });
      case 'syncAll': syncAll_(body.data || {}); return json_({ ok: true, timestamp: nowIso_() });

      // Produtos usam rotas próprias para garantir a auditoria da inclusão/alteração/exclusão.
      case 'salvarProduto': return json_({ ok: true, data: salvarProdutoAuditado_(body.produto || {}) });
      case 'excluirProduto': return json_({ ok: true, data: excluirProdutoAuditado_(String(body.id || '')) });

      case 'salvarOrcamento': return json_({ ok: true, data: salvarOrcamento_(body.orcamento || {}) });
      case 'excluirOrcamento': excluirOrcamento_(String(body.id || '')); return json_({ ok: true });
      case 'converterOrcamento': return json_({ ok: true, data: converterOrcamento_(String(body.id || ''), body.saleId || '') });
      case 'enviarOrcamentoEmail': return json_({ ok: true, data: enviarOrcamentoEmail_(String(body.id || '')) });

      case 'finalizarVenda': return json_({ ok: true, data: finalizarVenda_(body.venda || {}) });
      case 'cancelarVenda': return json_({ ok: true, data: cancelarVenda_(String(body.id || '')) });

      case 'finalizarCompra': return json_({ ok: true, data: finalizarCompra_(body.compra || {}) });
      case 'cancelarCompra': return json_({ ok: true, data: cancelarCompra_(String(body.id || '')) });

      case 'anexarComprovante': return json_({ ok: true, data: anexarComprovante_(body || {}) });
      case 'obterComprovante': return json_({ ok: true, data: obterComprovante_(body || {}) });

      case 'salvarFinanceiro': return json_({ ok: true, data: salvarFinanceiro_(body.lancamento || {}) });
      case 'marcarFinanceiroPago': return json_({ ok: true, data: marcarFinanceiroPago_(String(body.id || '')) });

      case 'salvarDespesa': return json_({ ok: true, data: salvarDespesa_(body.despesa || {}) });
      case 'excluirDespesa': excluirDespesa_(String(body.id || '')); return json_({ ok: true });
      case 'marcarDespesaPaga': return json_({ ok: true, data: marcarDespesaPaga_(String(body.id || '')) });

      case 'listarAuditoria': return json_({ ok: true, data: listarAuditoria_(body.filters || {}) });

      case 'listarUsuarios': return json_({ ok: true, data: listarUsuarios_() });
      case 'salvarUsuario': return json_({ ok: true, data: salvarUsuario_(body.usuario || {}, user) });
      case 'excluirUsuario': excluirUsuario_(String(body.id || ''), user); return json_({ ok: true });
      case 'alterarMinhaSenha': alterarSenhaPropria_(user, body.currentPassword || '', body.newPassword || ''); return json_({ ok: true });

      default: return json_({ ok: false, message: 'Ação não reconhecida: ' + action });
    }
  } catch (err) {
    log_('error', body && body.action, err.message);
    return json_({ ok: false, message: err.message });
  }
}
