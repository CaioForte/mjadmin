# Configuração — MJ Admin V11

## 1. Atualizar o projeto Apps Script existente

No mesmo projeto que já está conectado à planilha MJ, crie os seguintes arquivos de script:

```text
Code.gs
Config.gs
Database.gs
Utils.gs
Bootstrap.gs
Produtos.gs
Clientes.gs
Orcamentos.gs
Vendas.gs
Financeiro.gs
Despesas.gs
InfinitePay.gs
```

Copie o conteúdo do arquivo correspondente da pasta `apps-script/`.

> O `Code.gs` agora deve ficar pequeno. Não copie o conteúdo de Financeiro, Vendas etc. para dentro dele.

## 2. Executar o setup

Execute manualmente:

```javascript
setupDatabase()
```

As abas atuais são preservadas. Se a V11 precisar de uma nova coluna, o cabeçalho é ajustado.

## 3. Publicar a nova versão

Use **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**.

Configuração:

- Executar como: **Eu**
- Quem pode acessar: **Qualquer pessoa**

## 4. Teste

Abra a URL `/exec` em uma janela anônima. Deve retornar algo parecido com:

```json
{"ok":true,"version":"11.0.0","spreadsheetName":"MJ"}
```

Depois abra o painel e use **Configurações → Testar conexão**.

## Organização futura

Quando criarmos novos módulos, a regra será a mesma. Exemplo:

- Relatórios → `Relatorios.gs`
- Usuários/Login → `Usuarios.gs`
- Auditoria → `Auditoria.gs`

Assim o `Code.gs` permanece apenas como porta de entrada da API.


## Atualização V11.1
Após copiar os novos arquivos do Apps Script, execute `setupDatabase()` uma vez e publique uma nova versão da implantação. A URL `/exec` pode permanecer a mesma.
