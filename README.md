# MJ Envelopamento — Painel Administrativo V11.17

Versão com **Fornecedores + Compras / Entrada de Estoque** integrados ao Google Sheets.

## Novidades da V11.17

- Cadastro completo de fornecedores, sem dados de demonstração.
- Busca, edição, status Ativo/Inativo e proteção contra exclusão de fornecedor que já possui compras.
- Nova rotina **Compras / Entrada de estoque**.
- Compra com vários produtos, quantidade e custo unitário.
- Desconto em R$ e frete em R$.
- Opção para atualizar automaticamente o custo cadastrado do produto.
- Opção para gerar ou não lançamento financeiro.
- Status financeiro Pago/Pendente e vencimento.
- Entrada automática no estoque ao registrar a compra.
- Histórico de compras com visualizar, imprimir e cancelar.
- Cancelamento retira os itens do estoque e estorna o lançamento financeiro.
- O cancelamento é bloqueado se o estoque atual não for suficiente para estornar os itens daquela compra.
- Produtos e Despesas passam a sugerir os fornecedores cadastrados.

## Banco de dados

A V11.17 adiciona as abas **Compras** e **ComprasItens**. A aba **Fornecedores** já existente recebe campos adicionais. O Apps Script executa `setupDatabase_()` automaticamente quando a API é chamada, portanto as novas abas serão criadas após a implantação atualizada.

## Atualização

Atualize os arquivos do front-end e, no Apps Script, substitua **Code.gs**, **Config.gs** e **Bootstrap.gs** e adicione **Compras.gs** e **Fornecedores.gs**. Depois publique uma **nova versão da implantação Web App**, mantendo a mesma URL `/exec`.
