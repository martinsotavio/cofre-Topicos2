# Cofre de Senhas API

API RESTful de um gerenciador de senhas, desenvolvida para a disciplina **Tópicos de Desenvolvimento 2**.

O usuário cria uma conta, se autentica com JWT (com 2FA opcional por app autenticador) e guarda credenciais (sites, logins e senhas) organizadas em pastas. As senhas guardadas ficam **cifradas no banco com AES-256-GCM** e só são decifradas sob demanda, com registro em log de acesso.

## Requisitos do trabalho

| Requisito | Onde está |
|---|---|
| Ao menos três recursos | `usuarios`, `pastas` e `credenciais` (mais o histórico em `logs`) |
| Relacionamento funcional | `GET /pastas/:id/credenciais` retorna a pasta com as credenciais dela |
| Registro, login com JWT e rotas protegidas | `POST /auth/registro`, `POST /auth/login` e cabeçalho `Authorization: Bearer <token>` |
| Banco de dados com ORM | SQLite com Prisma (`prisma/schema.prisma`) |
| Tratamento de erros | formato único `{ erro, codigo, detalhes }`, veja [Erros](#erros) |
| Testes para todos os recursos | 75 testes com Jest + Supertest em `tests/` |
| Ponto extra: Swagger | documentação funcional em `/docs` |

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime / framework | Node.js 22 + Express 5 |
| Banco / ORM | SQLite + Prisma |
| Autenticação | JWT (`jsonwebtoken`) + `bcryptjs` + 2FA TOTP (`otplib`, `qrcode`) |
| Validação | zod |
| Segurança | helmet, express-rate-limit (rotas `/auth`) |
| Testes | Jest + Supertest |
| Documentação | Swagger UI (OpenAPI 3) em `/docs` |

## Como rodar

```bash
npm install
cp .env.example .env          # preencha JWT_SECRET e VAULT_KEY (comando de geração no próprio arquivo)
npx prisma migrate deploy     # cria o banco SQLite (prisma/dev.db)
npm run dev                   # http://localhost:3000  •  docs em http://localhost:3000/docs
```

Se a API rodar atrás de um proxy ou túnel (Cloudflare, Render etc.), defina `TRUST_PROXY=1` no `.env` para o rate limit usar o IP real de cada cliente.

Testes (usam um banco separado, `prisma/test.db`, recriado a cada execução):

```bash
npm test
```

### Postman / Insomnia

Importe `postman/cofre-de-senhas.postman_collection.json` (o Insomnia também importa esse formato). Com o servidor rodando, execute a coleção em ordem (ou pelo Collection Runner): o login guarda o token e as criações guardam `pastaId` e `credencialId` nas variáveis da coleção. A pasta **2FA** percorre o fluxo inteiro (ativar, confirmar, login com código, desativar): um script da coleção calcula o código TOTP como se fosse o app autenticador. A pasta **Limpeza** apaga tudo no final, então dá para rodar quantas vezes quiser.

Pela linha de comando:

```bash
npx newman run postman/cofre-de-senhas.postman_collection.json
```

## Modelo de dados

```
Usuario 1──N Pasta 1──N Credencial
Usuario 1──N Credencial
Credencial 1──N LogAcesso
```

- **Usuario**: nome, e-mail (único), `senhaHash` (bcrypt), `totpSecret` (segredo do 2FA, cifrado) e `totpAtivo`.
- **Pasta**: nome (único por usuário).
- **Credencial**: título, url, login, notas, `senhaCifrada` + `iv` + `authTag`. Pasta opcional.
- **LogAcesso**: ações `CRIAR`, `ATUALIZAR`, `REVELAR` em cada credencial.

## Segurança: hash x criptografia

- **Senha de login** → *hash* bcrypt. Não precisa ser lida de volta, só comparada.
- **Senhas do cofre** → *criptografia reversível* AES-256-GCM, com IV aleatório por registro. A chave (`VAULT_KEY`) fica só no `.env`, nunca no banco. O GCM também detecta adulteração (`authTag`).
- As listagens **nunca** devolvem a senha. Ela só aparece em `GET /credenciais/:id/revelar`, que gera log.
- Um usuário nunca acessa dados de outro. Nesse caso a API responde **404** (e não 403), para não revelar que o recurso existe.
- Login com e-mail inexistente e com senha errada retornam a mesma resposta, e o rate limit protege contra força bruta.
- **2FA (TOTP)** → o segredo do app autenticador também fica cifrado com AES-256-GCM. No login, o código só é pedido depois que a senha confere, para não revelar a quem não sabe a senha que a conta tem 2FA. Desligar o 2FA exige senha e código.
- Trocar a senha ou o e-mail em `PUT /usuarios/me` exige `senhaAtual`: só o token (se vazar) não basta para tomar a conta. A senha atual é conferida antes do e-mail, para não revelar quais e-mails estão cadastrados.

### Como ativar o 2FA

1. Logado, chame `POST /auth/2fa/ativar`. A resposta traz o `qrCode` (imagem em data URL, cole na barra do navegador para ver) e o `segredo`.
2. Leia o QR code (ou digite o segredo) no Google Authenticator, Authy ou similar.
3. Confirme com `POST /auth/2fa/verificar` e `{ "codigo": "123456" }`. A partir daí o login exige o campo `codigo`.

## Rotas

Rotas marcadas com **(auth)** exigem o cabeçalho `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/registro` | Cria conta |
| POST | `/auth/login` | Retorna token JWT (com 2FA ativo, envie também `codigo`) |
| POST | `/auth/2fa/ativar` (auth) | Gera segredo e QR code do 2FA |
| POST | `/auth/2fa/verificar` (auth) | Confirma o código e liga o 2FA |
| POST | `/auth/2fa/desativar` (auth) | Desliga o 2FA (exige `senha` e `codigo`) |
| GET / PUT / DELETE | `/usuarios/me` (auth) | Ver, atualizar e excluir a própria conta (trocar senha ou e-mail exige `senhaAtual`) |
| GET / POST | `/pastas` (auth) | Listar e criar pastas |
| GET / PUT / DELETE | `/pastas/:id` (auth) | Ver, renomear e excluir pasta |
| GET | `/pastas/:id/credenciais` (auth) | **Relacionamento:** pasta com suas credenciais |
| GET / POST | `/credenciais` (auth) | Listar (filtros `?pastaId=` e `?busca=`) e criar |
| GET / PUT / DELETE | `/credenciais/:id` (auth) | Ver, atualizar (parcial) e excluir |
| GET | `/credenciais/:id/revelar` (auth) | Decifra e retorna a senha |
| GET | `/credenciais/:id/logs` (auth) | Histórico de acesso |
| GET | `/gerador` | Gera senha forte (`?tamanho=&maiusculas=&numeros=&simbolos=`) |

## Erros

Todas as respostas de erro seguem o mesmo formato:

```json
{ "erro": "Dados inválidos", "codigo": "VALIDATION_ERROR", "detalhes": [{ "campo": "email", "mensagem": "E-mail inválido" }] }
```

| Status | Códigos |
|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `INVALID_ID`, `TOTP_NOT_STARTED`, `TOTP_NOT_ACTIVE` |
| 401 | `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `INVALID_PASSWORD`, `TOTP_REQUIRED`, `TOTP_INVALID` |
| 404 | `NOT_FOUND`, `ROUTE_NOT_FOUND` |
| 409 | `EMAIL_IN_USE`, `FOLDER_NAME_IN_USE`, `TOTP_ALREADY_ACTIVE`, `CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` (corpo acima de 100kb) |
| 429 | `TOO_MANY_REQUESTS` |
| 500 | `INTERNAL_ERROR` |

## Limitações conhecidas

- O JWT não tem lista de revogação: depois de trocar a senha, um token antigo continua válido até expirar (1h). Excluir a conta, por outro lado, invalida o token na hora.

## Próximos passos

- Códigos de recuperação do 2FA, para quando o usuário perde o celular.
- Frontend (fim do semestre).
- Derivar a chave do cofre de uma senha mestra do usuário (modelo *zero-knowledge*).
