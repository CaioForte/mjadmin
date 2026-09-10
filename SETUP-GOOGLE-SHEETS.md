# Google Sheets / Apps Script — V11.17

## Arquivos do Apps Script

Mantenha os módulos existentes e atualize/adicone:

- `Code.gs` — atualizado com as ações `finalizarCompra` e `cancelarCompra`.
- `Config.gs` — V11.17 e novas abas/colunas.
- `Bootstrap.gs` — sincroniza Fornecedores e Compras.
- `Compras.gs` — nova rotina atômica de entrada/cancelamento de estoque e financeiro.
- `Fornecedores.gs` — módulo de fornecedores.

## Depois de colar os arquivos

1. Salve o projeto do Apps Script.
2. Vá em **Implantar > Gerenciar implantações**.
3. Edite a implantação atual.
4. Selecione **Nova versão**.
5. Clique em **Implantar**.
6. A URL `/exec` pode permanecer a mesma.

Não é obrigatório executar `setupDatabase()` manualmente. A API executa a preparação das abas automaticamente no primeiro acesso. Se preferir, pode executar `setupDatabase()` uma vez para conferir imediatamente as novas abas `Compras` e `ComprasItens`.

## Fluxo da compra

Ao registrar uma compra, o backend grava a compra, os itens, movimentações de estoque, atualiza os produtos e, quando selecionado, cria uma saída no Financeiro. O cancelamento faz o processo inverso sob `LockService`, reduzindo risco de inconsistência.
