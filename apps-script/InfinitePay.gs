/** MJ ADMIN V11 - InfinitePay
 * Este arquivo concentra a lógica do provedor de pagamento.
 * A V11 mantém compatibilidade com o front atual; webhook/checkout pode evoluir aqui sem poluir Code.gs.
 */
function salvarConfigInfinitePay_(cfg){ writeConfig_('mj_infinitepay_config',cfg||{}); return cfg; }
function listarTransacoesInfinitePay_(){ return readObjects_('TransacoesInfinitePay'); }
