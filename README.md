# MJ Admin V11.12 — Sem dados demonstrativos + correção de Vendas

Esta versão usa somente os dados reais carregados do Google Sheets ou o cache local quando a API estiver indisponível.

## Correções principais

- Removidos dados demonstrativos de Produtos, Clientes, Orçamentos e Dashboard.
- Removidos gráfico, percentuais, notificações e indicadores fictícios do Dashboard.
- O gráfico de 7 dias e as formas de pagamento agora são calculados com vendas reais.
- Corrigida a inicialização que interrompia o JavaScript antes de carregar Clientes/Vendas.
- O Google Sheets é carregado antes do arquivo principal do sistema.
- Durante a carga inicial, o cache vazio não é enviado para a planilha.
- A listagem de Vendas ficou tolerante a registros incompletos, evitando que uma linha inválida quebre toda a tela.
- Botões Ver, Imprimir e Cancelar permanecem vinculados por delegação de eventos.

## Banco

Não há alteração de estrutura nas abas do Google Sheets nesta versão. Não é necessário executar `setupDatabase()` nem atualizar os arquivos `.gs` se a V11 modular já estiver implantada.


## V11.12 — Tela de carregamento

- Overlay bloqueia a interface durante a carga inicial do Google Sheets.
- Exibe progresso e mensagens reais de conexão/sincronização.
- Em falha, oferece **Tentar novamente** ou **Usar dados locais**.
- O menu só é liberado depois que o JavaScript principal termina de carregar.
