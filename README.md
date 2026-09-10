# MJ Admin V11.24.3

Correção da configuração inicial/login: o modal de autenticação agora fica acima da tela de carregamento.

# MJ Admin V11.23

## Novidades
- Login obrigatório no sistema.
- Sessão autenticada de até 6 horas.
- Cadastro e manutenção de usuários.
- Perfis: Administrador, Gerente, Vendedor, Financeiro e Estoque.
- Permissões por módulo, com possibilidade de personalização por usuário.
- Menu e atalhos respeitam as permissões do usuário conectado.
- Backend também valida permissões; não é apenas ocultação visual.
- Alteração de senha pelo próprio usuário.
- Botão de sair no topo do sistema.

## Arquivos do front-end
- `index.html`
- `css/styles.css`
- `js/api.js`
- `js/main.js`

## Apps Script
Atualize:
- `Code.gs`
- `Config.gs`

Adicione:
- `Usuarios.gs`

Os demais arquivos podem ser mantidos como estavam na V11.22.

## Primeiro acesso
Depois de atualizar o Apps Script:
1. Execute `setupDatabase()` uma vez.
2. Execute `configurarAdministradorInicial()`.
3. Informe nome, e-mail e senha do primeiro administrador nas janelas exibidas pelo Google Sheets.
4. Publique uma nova versão do Web App.
5. Abra o MJ Admin e faça login.

A senha é armazenada somente como hash SHA-256 com salt. O sistema não grava a senha em texto puro.


### V11.24.3
- Logout não recarrega mais a página antes de exibir o login.
- Ao clicar em Sair, a tela de login aparece imediatamente, sem mostrar a sincronização.
- Após um novo login, a página é recarregada para aplicar corretamente usuário e permissões.


## V11.24.5
- Exibe “Carregando dados...” enquanto valida sessão/configuração antes do login.
- Logout mostra “Saindo do sistema...” imediatamente.
- Campos de e-mail e senha são limpos ao retornar para o login após logout.
- Alterações somente no front-end.


## V11.24.6
- Corrigido o fluxo após logout: o primeiro login volta a funcionar sem exigir uma segunda tentativa.
- O logout limpa a sessão, recarrega a interface uma única vez e abre diretamente o login.
- E-mail e senha voltam vazios após sair.


## V11.25 - Otimização de desempenho

A carga inicial agora usa um bootstrap reduzido com apenas os dados necessários ao Dashboard. Clientes, fornecedores, compras e financeiro são carregados sob demanda quando o usuário abre os respectivos módulos. Isso reduz a quantidade de leitura no Google Sheets durante o login e evita carregar toda a base antes de exibir o painel.

Arquivos de backend alterados: `Code.gs`, `Config.gs` e `Bootstrap.gs`. Publique uma nova versão do Web App após substituir esses arquivos.
