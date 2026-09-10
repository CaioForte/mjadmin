# Configuração do Google Sheets — V11.23

## 1. Atualize o Apps Script
Substitua os arquivos:
- `Code.gs`
- `Config.gs`

Adicione o novo arquivo:
- `Usuarios.gs`

## 2. Atualize a estrutura da planilha
Execute:

```javascript
setupDatabase()
```

A aba `Usuarios` passa a armazenar também hash da senha, salt, permissões e último acesso.

## 3. Crie o primeiro administrador
Execute:

```javascript
configurarAdministradorInicial()
```

O Apps Script exibirá três perguntas: nome, e-mail e senha.
A senha deve ter pelo menos 6 caracteres.

## 4. Publique uma nova versão
No Apps Script:
**Implantar → Gerenciar implantações → Editar → Nova versão → Implantar**

A URL `/exec` pode continuar a mesma.

## 5. Validação
Ao abrir:

`.../exec?action=ping`

o retorno deve conter:

```json
"version":"11.23.0"
```

Depois abra o `index.html`. A tela de login deve aparecer antes da sincronização dos dados.


## V11.25 - carregamento otimizado
Substitua também `Bootstrap.gs`, `Code.gs` e `Config.gs` e publique uma nova versão do Web App. Não há novas colunas nem abas, portanto não é necessário executar `setupDatabase()` novamente. Após o deploy, `?action=ping` deve retornar `11.25.0`.
