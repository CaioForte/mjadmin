/** MJ ADMIN V11.15 - Envio de orçamento por e-mail */

function enviarOrcamentoEmail_(id) {
  if (!id) throw new Error('ID do orçamento não informado.');

  const orcamento = readObjects_('Orcamentos').find(function(q) {
    return String(q.id) === String(id);
  });
  if (!orcamento) throw new Error('Orçamento não encontrado.');

  const cliente = readObjects_('Clientes').find(function(c) {
    return String(c.id) === String(orcamento.clientId);
  });
  if (!cliente) throw new Error('Cliente do orçamento não encontrado.');

  const email = String(cliente.email || '').trim();
  if (!email) throw new Error('Este cliente não possui e-mail cadastrado.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('O e-mail cadastrado para este cliente é inválido.');
  }

  const itens = readObjects_('OrcamentosItens').filter(function(item) {
    return String(item.orcamentoId) === String(id);
  });
  if (!itens.length) throw new Error('O orçamento não possui itens para envio.');

  const nomeCliente = String(cliente.fantasyName || cliente.name || orcamento.cliente || 'Cliente');
  const numero = String(orcamento.num || id);
  const assunto = 'Orçamento ' + numero + ' - MJ Envelopamento';
  const html = montarEmailOrcamentoHtml_(orcamento, itens, nomeCliente);
  const texto = montarEmailOrcamentoTexto_(orcamento, itens, nomeCliente);

  MailApp.sendEmail({
    to: email,
    subject: assunto,
    body: texto,
    htmlBody: html,
    name: 'MJ Envelopamento'
  });

  log_('enviarOrcamentoEmail', id, email);

  return {
    id: id,
    numero: numero,
    email: email,
    enviadoEm: nowIso_()
  };
}

function montarEmailOrcamentoHtml_(q, itens, nomeCliente) {
  const linhas = itens.map(function(i) {
    const qtd = num_(i.qty);
    const unitario = num_(i.unitPrice);
    return '<tr>' +
      '<td style="padding:12px 10px;border-bottom:1px solid #ece9f5;color:#29243b;">' + htmlEscapeMj_(i.name || '') + '</td>' +
      '<td style="padding:12px 10px;border-bottom:1px solid #ece9f5;text-align:center;color:#5a536d;">' + htmlEscapeMj_(formatNumberMj_(qtd)) + '</td>' +
      '<td style="padding:12px 10px;border-bottom:1px solid #ece9f5;text-align:right;color:#5a536d;">' + htmlEscapeMj_(moneyMj_(unitario)) + '</td>' +
      '<td style="padding:12px 10px;border-bottom:1px solid #ece9f5;text-align:right;font-weight:700;color:#29243b;">' + htmlEscapeMj_(moneyMj_(qtd * unitario)) + '</td>' +
    '</tr>';
  }).join('');

  const desconto = num_(q.discount);
  const observacoes = String(q.obs || '').trim();
  const pagamento = String(q.paymentTerms || '').trim() || 'Não informada';

  return '<!doctype html><html><body style="margin:0;padding:0;background:#f5f3fa;font-family:Arial,Helvetica,sans-serif;color:#29243b;">' +
    '<div style="padding:28px 12px;">' +
      '<div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(51,32,85,.10);">' +
        '<div style="background:#5b2b82;padding:28px 32px;color:#fff;">' +
          '<div style="font-size:13px;letter-spacing:1.8px;text-transform:uppercase;opacity:.8;">MJ Envelopamento</div>' +
          '<div style="font-size:28px;font-weight:800;margin-top:6px;">Orçamento ' + htmlEscapeMj_(q.num || '') + '</div>' +
        '</div>' +
        '<div style="padding:30px 32px;">' +
          '<p style="font-size:16px;line-height:1.6;margin:0 0 20px;">Olá, <strong>' + htmlEscapeMj_(nomeCliente) + '</strong>!</p>' +
          '<p style="font-size:15px;line-height:1.6;color:#5a536d;margin:0 0 26px;">Segue abaixo o orçamento preparado pela MJ Envelopamento.</p>' +
          '<div style="display:block;background:#f7f5fb;border-radius:12px;padding:16px 18px;margin-bottom:24px;">' +
            '<div style="font-size:14px;color:#5a536d;line-height:1.8;"><strong style="color:#29243b;">Emissão:</strong> ' + htmlEscapeMj_(dateMj_(q.date)) + '<br>' +
            '<strong style="color:#29243b;">Validade:</strong> ' + htmlEscapeMj_(dateMj_(q.validity)) + '<br>' +
            '<strong style="color:#29243b;">Condição de pagamento:</strong> ' + htmlEscapeMj_(pagamento) + '</div>' +
          '</div>' +
          '<div style="overflow-x:auto;">' +
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">' +
              '<thead><tr style="background:#f1edf7;">' +
                '<th style="padding:12px 10px;text-align:left;color:#5b2b82;">Item</th>' +
                '<th style="padding:12px 10px;text-align:center;color:#5b2b82;">Qtd.</th>' +
                '<th style="padding:12px 10px;text-align:right;color:#5b2b82;">Unitário</th>' +
                '<th style="padding:12px 10px;text-align:right;color:#5b2b82;">Subtotal</th>' +
              '</tr></thead><tbody>' + linhas + '</tbody>' +
            '</table>' +
          '</div>' +
          '<div style="margin:26px 0 0 auto;max-width:320px;background:#f7f5fb;border-radius:12px;padding:18px;">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:10px;color:#5a536d;"><span>Subtotal</span><strong>' + htmlEscapeMj_(moneyMj_(q.subtotal)) + '</strong></div>' +
            (desconto > 0 ? '<div style="display:flex;justify-content:space-between;margin-bottom:10px;color:#5a536d;"><span>Desconto</span><strong>' + htmlEscapeMj_(moneyMj_(desconto)) + '</strong></div>' : '') +
            '<div style="border-top:1px solid #ddd6ea;padding-top:12px;display:flex;justify-content:space-between;font-size:19px;color:#5b2b82;"><strong>Total</strong><strong>' + htmlEscapeMj_(moneyMj_(q.total)) + '</strong></div>' +
          '</div>' +
          (observacoes ? '<div style="margin-top:24px;padding:18px;background:#faf9fc;border-left:4px solid #5b2b82;border-radius:8px;"><div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#5b2b82;margin-bottom:8px;">Observações</div><div style="font-size:14px;line-height:1.6;color:#5a536d;white-space:pre-line;">' + htmlEscapeMj_(observacoes) + '</div></div>' : '') +
          '<p style="font-size:14px;line-height:1.6;color:#5a536d;margin:28px 0 0;">Em caso de dúvidas, entre em contato conosco.</p>' +
          '<p style="font-size:15px;line-height:1.6;margin:14px 0 0;"><strong>MJ Envelopamento</strong></p>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</body></html>';
}

function montarEmailOrcamentoTexto_(q, itens, nomeCliente) {
  const linhas = [
    'Olá, ' + nomeCliente + '!',
    '',
    'Segue o orçamento ' + String(q.num || '') + ' da MJ Envelopamento.',
    'Emissão: ' + dateMj_(q.date),
    'Validade: ' + dateMj_(q.validity),
    '',
    'ITENS:'
  ];
  itens.forEach(function(i) {
    const qtd = num_(i.qty);
    const unitario = num_(i.unitPrice);
    linhas.push('- ' + String(i.name || '') + ' | ' + formatNumberMj_(qtd) + ' x ' + moneyMj_(unitario) + ' = ' + moneyMj_(qtd * unitario));
  });
  linhas.push('', 'Subtotal: ' + moneyMj_(q.subtotal));
  if (num_(q.discount) > 0) linhas.push('Desconto: ' + moneyMj_(q.discount));
  linhas.push('TOTAL: ' + moneyMj_(q.total));
  if (q.paymentTerms) linhas.push('', 'Condição de pagamento: ' + q.paymentTerms);
  if (q.obs) linhas.push('', 'Observações: ' + q.obs);
  linhas.push('', 'MJ Envelopamento');
  return linhas.join('\n');
}

function htmlEscapeMj_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function moneyMj_(value) {
  return Number(num_(value)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumberMj_(value) {
  return Number(num_(value)).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function dateMj_(value) {
  const s = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '-';
  const p = s.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}
