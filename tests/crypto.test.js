const { cifrar, decifrar, gerarSenha } = require('../src/lib/crypto');

describe('lib/crypto', () => {
  test('cifra e decifra de volta o mesmo texto', () => {
    const dados = cifrar('minha-senha-ção-ñ-€');
    expect(dados.senhaCifrada).not.toContain('minha-senha');
    expect(decifrar(dados)).toBe('minha-senha-ção-ñ-€');
  });

  test('mesmo texto gera cifras diferentes (IV aleatório)', () => {
    const a = cifrar('igual');
    const b = cifrar('igual');
    expect(a.iv).not.toBe(b.iv);
    expect(a.senhaCifrada).not.toBe(b.senhaCifrada);
  });

  test('detecta adulteração do texto cifrado (authTag)', () => {
    const dados = cifrar('original');
    const bytes = Buffer.from(dados.senhaCifrada, 'base64');
    bytes[0] ^= 0xff;
    expect(() => decifrar({ ...dados, senhaCifrada: bytes.toString('base64') })).toThrow();
  });

  test('gerarSenha respeita tamanho e conjuntos', () => {
    const senha = gerarSenha({ tamanho: 32 });
    expect(senha).toHaveLength(32);
    expect(senha).toMatch(/[a-z]/);
    expect(senha).toMatch(/[A-Z]/);
    expect(senha).toMatch(/[0-9]/);
    expect(senha).toMatch(/[^a-zA-Z0-9]/);

    expect(gerarSenha({ tamanho: 12, maiusculas: false, numeros: false, simbolos: false })).toMatch(/^[a-z]{12}$/);
  });
});
