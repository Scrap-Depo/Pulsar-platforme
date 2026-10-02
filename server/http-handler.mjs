// Shared HTTP boundary for Vercel and the local HTTP integration check.
export function createHttpHandler(getServices) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const reply = (status, body) => res.status(status).json(body);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return reply(405, { error: { message: 'Используйте POST.' } });
    }
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
    if (!match) return reply(401, { error: { message: 'Войдите в приложение.' } });
    let input;
    try {
      input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!input || Array.isArray(input) || typeof input.action !== 'string') throw new Error();
      if (Buffer.byteLength(JSON.stringify(input)) > 128 * 1024) {
        return reply(413, { error: { message: 'Слишком большой запрос.' } });
      }
    } catch {
      return reply(400, { error: { message: 'Некорректный запрос.' } });
    }
    let services;
    try {
      services = getServices();
    } catch {
      console.error('Pulsar server configuration is unavailable.');
      return reply(503, { error: { message: 'Сервер встреч не настроен. Обратитесь к администратору.' } });
    }
    let identity;
    try {
      identity = await services.auth.verifyIdToken(match[1], true);
    } catch {
      return reply(401, { error: { message: 'Сессия входа истекла или недействительна. Войдите заново.' } });
    }
    try {
      // Identity and provider always come from the verified token, never the body.
      const data = await services.execute(identity.uid, identity.firebase?.sign_in_provider, input);
      return reply(200, { data });
    } catch (error) {
      if (error instanceof Error && !('code' in error)) {
        return reply(400, { error: { message: error.message } });
      }
      console.error('Pulsar storage request failed.', error?.code);
      return reply(503, { error: { message: 'Нет ответа от хранилища. Повторите запрос.' } });
    }
  };
}
