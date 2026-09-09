# InfinitePay — MJ Admin V9

A V9 implementa a integração do Checkout Integrado da InfinitePay no front-end do protótipo.

## Fluxo

1. Configure a InfiniteTag/Handle em **Configurações > Integrações**.
2. Cadastre uma URL de retorno HTTPS do sistema publicado.
3. Em **Nova Venda**, escolha **InfinitePay**.
4. Ao finalizar, a venda é salva como **Pendente**, o estoque é baixado e o financeiro recebe uma conta a receber.
5. O sistema envia `POST https://api.checkout.infinitepay.io/links` usando o número da venda como `order_nsu`.
6. O cliente é redirecionado para o checkout retornado pela InfinitePay.
7. No retorno, o sistema lê `order_nsu`, `transaction_nsu` e `slug`, consulta `POST https://api.checkout.infinitepay.io/payment_check` e só então marca a venda como **Pago**.

## Observações importantes

- A URL de webhook exige backend publicado e não pode ser processada por um HTML estático.
- O protótipo confirma o pagamento pelo retorno do checkout e pela chamada `payment_check`.
- A integração valida o `order_nsu` e o valor esperado antes de alterar a venda para paga.
- Nenhum dado de cartão é coletado ou armazenado pelo MJ Admin.
- Para produção, a próxima etapa recomendada é mover vendas, financeiro e webhooks para um banco/backend real.
