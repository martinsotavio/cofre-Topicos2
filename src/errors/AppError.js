class AppError extends Error {
  constructor(status, mensagem, codigo) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }

  static naoEncontrado(mensagem = 'Recurso não encontrado') {
    return new AppError(404, mensagem, 'NOT_FOUND');
  }
}

module.exports = AppError;
