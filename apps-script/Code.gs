/** MJ ADMIN V11 - Entrada da API. Mantenha este arquivo enxuto. */
function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'ping');
  return route_({ action: action });
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
    switch (body.action) {
      case 'ping': return json_({ ok: true, version: MJ_DB.version, spreadsheetName: getDb_().getName(), timestamp: nowIso_() });
      case 'bootstrap': return json_({ ok: true, version: MJ_DB.version, spreadsheetName: getDb_().getName(), data: bootstrapData_() });
      case 'syncKey': syncKey_(String(body.key || ''), body.data); return json_({ ok: true, key: body.key, timestamp: nowIso_() });
      case 'syncAll': syncAll_(body.data || {}); return json_({ ok: true, timestamp: nowIso_() });

      case 'salvarOrcamento': return json_({ ok: true, data: salvarOrcamento_(body.orcamento || {}) });
      case 'excluirOrcamento': excluirOrcamento_(String(body.id || '')); return json_({ ok: true });
      case 'converterOrcamento': return json_({ ok: true, data: converterOrcamento_(String(body.id || ''), body.saleId || '') });
      case 'enviarOrcamentoEmail': return json_({ ok: true, data: enviarOrcamentoEmail_(String(body.id || '')) });

      case 'finalizarVenda': return json_({ ok: true, data: finalizarVenda_(body.venda || {}) });
      case 'cancelarVenda': return json_({ ok: true, data: cancelarVenda_(String(body.id || '')) });

      case 'finalizarCompra': return json_({ ok: true, data: finalizarCompra_(body.compra || {}) });
      case 'cancelarCompra': return json_({ ok: true, data: cancelarCompra_(String(body.id || '')) });

      case 'salvarFinanceiro': return json_({ ok: true, data: salvarFinanceiro_(body.lancamento || {}) });
      case 'marcarFinanceiroPago': return json_({ ok: true, data: marcarFinanceiroPago_(String(body.id || '')) });

      case 'salvarDespesa': return json_({ ok: true, data: salvarDespesa_(body.despesa || {}) });
      case 'excluirDespesa': excluirDespesa_(String(body.id || '')); return json_({ ok: true });
      case 'marcarDespesaPaga': return json_({ ok: true, data: marcarDespesaPaga_(String(body.id || '')) });

      default: return json_({ ok: false, message: 'Ação não reconhecida: ' + body.action });
    }
  } catch (err) {
    log_('error', body && body.action, err.message);
    return json_({ ok: false, message: err.message });
  }
}
