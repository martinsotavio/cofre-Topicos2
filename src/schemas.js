const { z } = require('zod');

const email = z.string({ required_error: 'E-mail é obrigatório' }).trim().toLowerCase().email('E-mail inválido');
const senhaUsuario = z
  .string({ required_error: 'Senha é obrigatória' })
  .min(8, 'Senha deve ter ao menos 8 caracteres')
  .max(128, 'Senha deve ter no máximo 128 caracteres');
const nome = z.string({ required_error: 'Nome é obrigatório' }).trim().min(2, 'Nome deve ter ao menos 2 caracteres').max(100);
const naoVazio = (obj) => Object.keys(obj).length > 0;

const registro = z.object({ nome, email, senha: senhaUsuario });

const senhaInformada = z.string({ required_error: 'Senha é obrigatória' }).min(1, 'Senha é obrigatória');
const codigoTotp = z
  .string({ required_error: 'Código é obrigatório' })
  .trim()
  .regex(/^\d{6}$/, 'Código deve ter 6 dígitos');

const login = z.object({ email, senha: senhaInformada, codigo: codigoTotp.optional() });

const verificar2fa = z.object({ codigo: codigoTotp });
const desativar2fa = z.object({ senha: senhaInformada, codigo: codigoTotp });

// Trocar senha ou e-mail exige a senha atual: um token vazado não basta para tomar a conta
const atualizarUsuario = z
  .object({ nome: nome.optional(), email: email.optional(), senha: senhaUsuario.optional(), senhaAtual: z.string().optional() })
  .strict()
  .refine(({ senhaAtual, ...campos }) => naoVazio(campos), 'Informe ao menos um campo para atualizar')
  .refine(({ senha, email, senhaAtual }) => !(senha || email) || senhaAtual, {
    message: 'Informe a senha atual para trocar a senha ou o e-mail',
    path: ['senhaAtual'],
  });

const pasta = z.object({
  nome: z.string({ required_error: 'Nome é obrigatório' }).trim().min(1, 'Nome é obrigatório').max(60),
});

const credencialBase = z.object({
  titulo: z.string({ required_error: 'Título é obrigatório' }).trim().min(1, 'Título é obrigatório').max(100),
  url: z.string().trim().url('URL inválida').max(500).nullable().optional(),
  login: z.string().trim().max(200).nullable().optional(),
  senha: z.string({ required_error: 'Senha é obrigatória' }).min(1, 'Senha é obrigatória').max(500),
  notas: z.string().max(2000).nullable().optional(),
  pastaId: z.number({ invalid_type_error: 'pastaId deve ser um número' }).int().positive('pastaId inválido').nullable().optional(),
});

const criarCredencial = credencialBase.strict();
const atualizarCredencial = credencialBase.partial().strict().refine(naoVazio, 'Informe ao menos um campo para atualizar');

// Express 5 transforma "?busca=a&busca=b" em array; aqui só aceitamos um texto
const filtrosCredencial = z.object({
  busca: z.string({ invalid_type_error: 'Informe "busca" uma única vez' }).max(100).optional(),
});

const flag = z.enum(['true', 'false']).default('true').transform((v) => v === 'true');
const gerador = z.object({
  tamanho: z.coerce.number().int().min(8, 'tamanho mínimo é 8').max(128, 'tamanho máximo é 128').default(20),
  maiusculas: flag,
  numeros: flag,
  simbolos: flag,
});

module.exports = { registro, login, verificar2fa, desativar2fa, atualizarUsuario, pasta, criarCredencial, atualizarCredencial, filtrosCredencial, gerador };
