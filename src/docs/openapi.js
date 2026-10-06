const json = (schema) => ({ content: { 'application/json': { schema } } });
const ref = (nome) => ({ $ref: `#/components/schemas/${nome}` });
const erro = (descricao) => ({ description: descricao, ...json(ref('Erro')) });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 } };
const protegida = { security: [{ bearerAuth: [] }] };

const respostasProtegidas = {
  401: erro('Token ausente, inválido, expirado ou de uma conta que não existe mais'),
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Cofre de Senhas API',
    version: '1.0.0',
    description:
      'API REST de um gerenciador de senhas. As senhas guardadas são cifradas com AES-256-GCM; ' +
      'a senha de login do usuário é armazenada como hash bcrypt.\n\n' +
      '**Como testar:** registre-se em `POST /auth/registro`, faça login em `POST /auth/login`, ' +
      'copie o `token` e clique em **Authorize**.\n\n' +
      'Todos os erros seguem o formato `{ erro, codigo, detalhes? }`. Corpos acima de 100kb retornam **413**.\n\n' +
      '**2FA (opcional):** com o token, chame `POST /auth/2fa/ativar`, leia o QR code (ou digite o `segredo`) ' +
      'no Google Authenticator e confirme em `POST /auth/2fa/verificar`. Depois disso o login exige o campo `codigo`.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Auth', description: 'Registro e login (JWT)' },
    { name: '2FA', description: 'Autenticação em dois fatores (TOTP, Google Authenticator e similares)' },
    { name: 'Usuários', description: 'Conta do usuário autenticado' },
    { name: 'Pastas', description: 'Organização das credenciais' },
    { name: 'Credenciais', description: 'Senhas guardadas no cofre' },
    { name: 'Gerador', description: 'Gerador de senhas fortes' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Erro: {
        type: 'object',
        properties: {
          erro: { type: 'string', example: 'Credencial não encontrada' },
          codigo: { type: 'string', example: 'NOT_FOUND' },
          detalhes: {
            type: 'array',
            items: { type: 'object', properties: { campo: { type: 'string' }, mensagem: { type: 'string' } } },
          },
        },
      },
      Usuario: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nome: { type: 'string', example: 'Maria Silva' },
          email: { type: 'string', example: 'maria@email.com' },
          totpAtivo: { type: 'boolean', example: false },
          criadoEm: { type: 'string', format: 'date-time' },
        },
      },
      Registro: {
        type: 'object',
        required: ['nome', 'email', 'senha'],
        properties: {
          nome: { type: 'string', example: 'Maria Silva' },
          email: { type: 'string', example: 'maria@email.com' },
          senha: { type: 'string', minLength: 8, example: 'senhaForte123' },
        },
      },
      Login: {
        type: 'object',
        required: ['email', 'senha'],
        properties: {
          email: { type: 'string', example: 'maria@email.com' },
          senha: { type: 'string', example: 'senhaForte123' },
          codigo: {
            type: 'string',
            pattern: '^\\d{6}$',
            description: 'Código de 6 dígitos do app autenticador. Obrigatório só quando o 2FA está ativo',
            example: '123456',
          },
        },
      },
      Ativar2fa: {
        type: 'object',
        properties: {
          segredo: { type: 'string', description: 'Para digitar no app caso não dê para ler o QR code', example: 'F4JTE4SAGBKHSO3F' },
          otpauthUrl: { type: 'string', example: 'otpauth://totp/Cofre%20de%20Senhas:maria%40email.com?secret=F4JTE4SAGBKHSO3F' },
          qrCode: { type: 'string', description: 'Imagem PNG em data URL (cole na barra do navegador para ver)' },
          instrucoes: { type: 'string' },
        },
      },
      Codigo2fa: {
        type: 'object',
        required: ['codigo'],
        properties: { codigo: { type: 'string', pattern: '^\\d{6}$', example: '123456' } },
      },
      Desativar2fa: {
        type: 'object',
        required: ['senha', 'codigo'],
        properties: {
          senha: { type: 'string', example: 'senhaForte123' },
          codigo: { type: 'string', pattern: '^\\d{6}$', example: '123456' },
        },
      },
      Status2fa: {
        type: 'object',
        properties: { mensagem: { type: 'string', example: '2FA ativado' }, totpAtivo: { type: 'boolean' } },
      },
      Token: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          tipo: { type: 'string', example: 'Bearer' },
          expiraEm: { type: 'string', example: '1h' },
          usuario: ref('Usuario'),
        },
      },
      AtualizarUsuario: {
        type: 'object',
        description: 'Informe ao menos um campo. Para trocar `senha` ou `email`, envie também `senhaAtual`',
        properties: {
          nome: { type: 'string', example: 'Maria S. Silva' },
          email: { type: 'string' },
          senha: { type: 'string', minLength: 8, description: 'Nova senha' },
          senhaAtual: { type: 'string', description: 'Obrigatória ao trocar senha ou e-mail', example: 'senhaForte123' },
        },
      },
      PastaInput: {
        type: 'object',
        required: ['nome'],
        properties: { nome: { type: 'string', example: 'Bancos' } },
      },
      Pasta: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nome: { type: 'string', example: 'Bancos' },
          usuarioId: { type: 'integer', example: 1 },
          criadoEm: { type: 'string', format: 'date-time' },
          totalCredenciais: { type: 'integer', example: 2 },
        },
      },
      PastaComCredenciais: {
        allOf: [ref('Pasta'), { type: 'object', properties: { credenciais: { type: 'array', items: ref('Credencial') } } }],
      },
      CredencialInput: {
        type: 'object',
        required: ['titulo', 'senha'],
        properties: {
          titulo: { type: 'string', example: 'GitHub' },
          url: { type: 'string', nullable: true, example: 'https://github.com' },
          login: { type: 'string', nullable: true, example: 'maria' },
          senha: { type: 'string', example: 'minha-senha-secreta' },
          notas: { type: 'string', nullable: true, example: 'Conta pessoal' },
          pastaId: { type: 'integer', nullable: true, example: 1 },
        },
      },
      Credencial: {
        type: 'object',
        description: 'A senha nunca é retornada aqui; use GET /credenciais/{id}/revelar',
        properties: {
          id: { type: 'integer', example: 1 },
          titulo: { type: 'string', example: 'GitHub' },
          url: { type: 'string', nullable: true },
          login: { type: 'string', nullable: true },
          notas: { type: 'string', nullable: true },
          pastaId: { type: 'integer', nullable: true },
          pasta: {
            type: 'object',
            nullable: true,
            properties: { id: { type: 'integer' }, nome: { type: 'string' } },
          },
          usuarioId: { type: 'integer' },
          criadoEm: { type: 'string', format: 'date-time' },
          atualizadoEm: { type: 'string', format: 'date-time' },
        },
      },
      SenhaRevelada: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          titulo: { type: 'string', example: 'GitHub' },
          login: { type: 'string', nullable: true, example: 'maria' },
          senha: { type: 'string', example: 'minha-senha-secreta' },
        },
      },
      Log: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          acao: { type: 'string', enum: ['CRIAR', 'ATUALIZAR', 'REVELAR'] },
          criadoEm: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/auth/registro': {
      post: {
        tags: ['Auth'],
        summary: 'Cria uma conta',
        requestBody: { required: true, ...json(ref('Registro')) },
        responses: {
          201: { description: 'Usuário criado', ...json(ref('Usuario')) },
          400: erro('Dados inválidos'),
          409: erro('E-mail já cadastrado'),
          429: erro('Muitas tentativas'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Autentica e retorna um token JWT',
        requestBody: { required: true, ...json(ref('Login')) },
        responses: {
          200: { description: 'Login realizado', ...json(ref('Token')) },
          400: erro('Dados inválidos'),
          401: erro('E-mail ou senha incorretos (INVALID_CREDENTIALS), código 2FA ausente (TOTP_REQUIRED) ou inválido (TOTP_INVALID)'),
          429: erro('Muitas tentativas'),
        },
      },
    },
    '/auth/2fa/ativar': {
      post: {
        tags: ['2FA'],
        summary: 'Gera o segredo e o QR code (o 2FA só liga depois do /verificar)',
        ...protegida,
        responses: {
          200: { description: 'Segredo gerado', ...json(ref('Ativar2fa')) },
          409: erro('2FA já está ativo'),
          ...respostasProtegidas,
        },
      },
    },
    '/auth/2fa/verificar': {
      post: {
        tags: ['2FA'],
        summary: 'Confirma o primeiro código do app e liga o 2FA',
        ...protegida,
        requestBody: { required: true, ...json(ref('Codigo2fa')) },
        responses: {
          200: { description: '2FA ativado', ...json(ref('Status2fa')) },
          400: erro('Código mal formatado ou ativação não iniciada (TOTP_NOT_STARTED)'),
          401: erro('Token inválido ou código 2FA incorreto (TOTP_INVALID)'),
          409: erro('2FA já está ativo'),
        },
      },
    },
    '/auth/2fa/desativar': {
      post: {
        tags: ['2FA'],
        summary: 'Desliga o 2FA (exige senha e código)',
        ...protegida,
        requestBody: { required: true, ...json(ref('Desativar2fa')) },
        responses: {
          200: { description: '2FA desativado', ...json(ref('Status2fa')) },
          400: erro('Dados inválidos ou 2FA não ativo (TOTP_NOT_ACTIVE)'),
          401: erro('Token inválido, senha incorreta (INVALID_PASSWORD) ou código incorreto (TOTP_INVALID)'),
        },
      },
    },
    '/usuarios/me': {
      get: {
        tags: ['Usuários'],
        summary: 'Dados do usuário autenticado',
        ...protegida,
        responses: { 200: { description: 'OK', ...json(ref('Usuario')) }, ...respostasProtegidas },
      },
      put: {
        tags: ['Usuários'],
        summary: 'Atualiza nome, e-mail e/ou senha (e-mail e senha exigem senhaAtual)',
        ...protegida,
        requestBody: { required: true, ...json(ref('AtualizarUsuario')) },
        responses: {
          200: { description: 'Atualizado', ...json(ref('Usuario')) },
          400: erro('Dados inválidos ou senhaAtual ausente'),
          401: erro('Token inválido ou senha atual incorreta (INVALID_PASSWORD)'),
          409: erro('E-mail já cadastrado'),
        },
      },
      delete: {
        tags: ['Usuários'],
        summary: 'Exclui a conta e todo o cofre',
        ...protegida,
        responses: { 204: { description: 'Conta excluída' }, ...respostasProtegidas },
      },
    },
    '/pastas': {
      get: {
        tags: ['Pastas'],
        summary: 'Lista as pastas do usuário',
        ...protegida,
        responses: {
          200: { description: 'OK', ...json({ type: 'array', items: ref('Pasta') }) },
          ...respostasProtegidas,
        },
      },
      post: {
        tags: ['Pastas'],
        summary: 'Cria uma pasta',
        ...protegida,
        requestBody: { required: true, ...json(ref('PastaInput')) },
        responses: {
          201: { description: 'Criada', ...json(ref('Pasta')) },
          400: erro('Dados inválidos'),
          409: erro('Nome de pasta já usado'),
          ...respostasProtegidas,
        },
      },
    },
    '/pastas/{id}': {
      parameters: [idParam],
      get: {
        tags: ['Pastas'],
        summary: 'Busca uma pasta',
        ...protegida,
        responses: {
          200: { description: 'OK', ...json(ref('Pasta')) },
          404: erro('Pasta não encontrada'),
          ...respostasProtegidas,
        },
      },
      put: {
        tags: ['Pastas'],
        summary: 'Renomeia uma pasta',
        ...protegida,
        requestBody: { required: true, ...json(ref('PastaInput')) },
        responses: {
          200: { description: 'Atualizada', ...json(ref('Pasta')) },
          400: erro('Dados inválidos'),
          404: erro('Pasta não encontrada'),
          409: erro('Nome de pasta já usado'),
          ...respostasProtegidas,
        },
      },
      delete: {
        tags: ['Pastas'],
        summary: 'Exclui a pasta (as credenciais ficam sem pasta)',
        ...protegida,
        responses: { 204: { description: 'Excluída' }, 404: erro('Pasta não encontrada'), ...respostasProtegidas },
      },
    },
    '/pastas/{id}/credenciais': {
      parameters: [idParam],
      get: {
        tags: ['Pastas'],
        summary: 'Pasta com as credenciais dela (relacionamento 1:N)',
        ...protegida,
        responses: {
          200: { description: 'OK', ...json(ref('PastaComCredenciais')) },
          404: erro('Pasta não encontrada'),
          ...respostasProtegidas,
        },
      },
    },
    '/credenciais': {
      get: {
        tags: ['Credenciais'],
        summary: 'Lista as credenciais (sem senha)',
        ...protegida,
        parameters: [
          { name: 'pastaId', in: 'query', schema: { type: 'integer' } },
          { name: 'busca', in: 'query', description: 'Filtra pelo título', schema: { type: 'string' } },
        ],
        responses: {
          200: { description: 'OK', ...json({ type: 'array', items: ref('Credencial') }) },
          ...respostasProtegidas,
        },
      },
      post: {
        tags: ['Credenciais'],
        summary: 'Guarda uma credencial (senha é cifrada)',
        ...protegida,
        requestBody: { required: true, ...json(ref('CredencialInput')) },
        responses: {
          201: { description: 'Criada', ...json(ref('Credencial')) },
          400: erro('Dados inválidos'),
          404: erro('Pasta não encontrada'),
          ...respostasProtegidas,
        },
      },
    },
    '/credenciais/{id}': {
      parameters: [idParam],
      get: {
        tags: ['Credenciais'],
        summary: 'Busca uma credencial (sem senha)',
        ...protegida,
        responses: {
          200: { description: 'OK', ...json(ref('Credencial')) },
          404: erro('Credencial não encontrada'),
          ...respostasProtegidas,
        },
      },
      put: {
        tags: ['Credenciais'],
        summary: 'Atualiza uma credencial (campos parciais)',
        ...protegida,
        requestBody: { required: true, ...json(ref('CredencialInput')) },
        responses: {
          200: { description: 'Atualizada', ...json(ref('Credencial')) },
          400: erro('Dados inválidos'),
          404: erro('Credencial ou pasta não encontrada'),
          ...respostasProtegidas,
        },
      },
      delete: {
        tags: ['Credenciais'],
        summary: 'Exclui uma credencial',
        ...protegida,
        responses: { 204: { description: 'Excluída' }, 404: erro('Credencial não encontrada'), ...respostasProtegidas },
      },
    },
    '/credenciais/{id}/revelar': {
      parameters: [idParam],
      get: {
        tags: ['Credenciais'],
        summary: 'Decifra e retorna a senha (registra log REVELAR)',
        ...protegida,
        responses: {
          200: { description: 'OK', ...json(ref('SenhaRevelada')) },
          404: erro('Credencial não encontrada'),
          ...respostasProtegidas,
        },
      },
    },
    '/credenciais/{id}/logs': {
      parameters: [idParam],
      get: {
        tags: ['Credenciais'],
        summary: 'Histórico de acesso da credencial',
        ...protegida,
        responses: {
          200: { description: 'OK', ...json({ type: 'array', items: ref('Log') }) },
          404: erro('Credencial não encontrada'),
          ...respostasProtegidas,
        },
      },
    },
    '/gerador': {
      get: {
        tags: ['Gerador'],
        summary: 'Gera uma senha forte',
        parameters: [
          { name: 'tamanho', in: 'query', schema: { type: 'integer', minimum: 8, maximum: 128, default: 20 } },
          { name: 'maiusculas', in: 'query', schema: { type: 'string', enum: ['true', 'false'], default: 'true' } },
          { name: 'numeros', in: 'query', schema: { type: 'string', enum: ['true', 'false'], default: 'true' } },
          { name: 'simbolos', in: 'query', schema: { type: 'string', enum: ['true', 'false'], default: 'true' } },
        ],
        responses: {
          200: {
            description: 'OK',
            ...json({
              type: 'object',
              properties: {
                senha: { type: 'string', example: 'viiQYcoDB1bQ83pk' },
                tamanho: { type: 'integer', example: 16 },
                maiusculas: { type: 'boolean' },
                numeros: { type: 'boolean' },
                simbolos: { type: 'boolean' },
              },
            }),
          },
          400: erro('Parâmetros inválidos'),
        },
      },
    },
  },
};
