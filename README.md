# MJ Admin V11.27.2

Versão com carregamento completo e novo módulo de Auditoria. Os últimos 1000 registros de auditoria são carregados junto com o restante dos dados após o login.

## Atualização do Apps Script
Substitua os arquivos `Code.gs`, `Config.gs`, `Utils.gs`, `Usuarios.gs`, `Bootstrap.gs`, `Financeiro.gs`, `Orcamentos.gs` e adicione `Auditoria.gs`. Depois publique uma nova versão da implantação. Não é necessário executar `setupDatabase()` manualmente; a estrutura da aba `Logs` é atualizada automaticamente na primeira chamada.

## Auditoria
Registra usuário, data/hora, módulo, ação, registro afetado e detalhes. Senhas, hashes e tokens não são registrados. A tela de Auditoria é somente leitura.


## V11.27.2
- Auditoria removida do bootstrap inicial.
- Registros são buscados somente ao abrir o módulo Auditoria.
- Ao abrir a Auditoria, os dados são atualizados do servidor.
- Logs técnicos de sincronização completa não são exibidos na auditoria funcional.
