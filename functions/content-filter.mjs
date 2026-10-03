// Heuristics for review, not a classifier of intent or political opinions.
// Keep this list on the server: clients must not bypass the publication gate.
const profanity =
  /^(?:бля(?:д[а-я]*|ть|ха)?|бляд[а-я]*|(?:за|на|по|вы|от|до|про|раз|рас|с|долбо)?(?:е|ё)б[а-я]*|(?:на|по|за|ни|о)?ху[йяеёию][а-я]*|(?:по|до|на|за|вы)?пизд[а-я]*|мудак[а-я]*|мудил[а-я]*)$/u;
const spacedProfanity =
  /(?:^|[^\p{L}])(?:х[\s.*_\-]+у[\s.*_\-]+й|б[\s.*_\-]+л[\s.*_\-]+я[\s.*_\-]+д[\s.*_\-]+ь)(?=$|[^\p{L}])/u;
const threat =
  /(?:террор(?:изм|ист|истическ)|теракт|взорв(?:ать|ём|ем|у)|(?:убить|расстрелять|подорвать)\s+(?:людей|человека|школу|толпу)|(?:сделать|собрать|изготовить)\s+бомб)/u;
const politics =
  /(?:^|[^\p{L}])(?:политик[а-я]*|выбор(?:ы|ов|ах|ам|ами)|президент[а-я]*|парламент[а-я]*|путин[а-я]*|зеленск[а-я]*|навальн[а-я]*|митинг[а-я]*|санкци[а-я]*)(?=$|[^\p{L}])/u;

const normalize = (value) =>
  value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/\s+/gu, ' ')
    .trim();
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const literalPattern = (value) =>
  new RegExp(`(^|[^\\p{L}\\p{N}])(${escape(value)})(?=$|[^\\p{L}\\p{N}])`, 'gu');
const businessExceptions =
  /(?:^|[^\p{L}])политик(?:а|и|у|ой|е|ою)\s+(?:компании|организации|предприятия|конфиденциальности|безопасности|качества|оплаты|возврата)(?=$|[^\p{L}])/gu;

export function contentPolicy(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Некорректные настройки фильтра.');
  const list = (value, label) => {
    if (value === undefined) return [];
    if (
      !Array.isArray(value) ||
      value.length > 100 ||
      value.some((word) => typeof word !== 'string' || !word.trim() || [...word.trim()].length > 80)
    )
      throw new Error(`${label}: до 100 слов или фраз, каждое от 1 до 80 символов.`);
    return [...new Set(value.map(normalize))];
  };
  return {
    blockedWords: list(input.blockedWords, 'Запрещённые слова'),
    allowedPhrases: list(input.allowedPhrases, 'Разрешённые деловые фразы'),
  };
}

export function filterReasons(value, policy = {}, builtIn = true) {
  if (typeof value !== 'string') return [];
  const source = normalize(value);
  const tokens = source.match(/[\p{L}]+/gu) ?? [];
  // Also catch common spacing/punctuation evasions inside a short swear word.
  const joined = source.replace(/(?<=\p{L})[.*_\-\s]+(?=\p{L})/gu, '');
  const reasons = [];
  if (
    builtIn &&
    (tokens.some((word) => profanity.test(word)) ||
      profanity.test(joined) ||
      spacedProfanity.test(source))
  )
    reasons.push('Нецензурная лексика');
  if (builtIn && threat.test(source)) reasons.push('Терроризм или угрозы насилия');
  let politicalText = source.replace(businessExceptions, ' ');
  for (const phrase of policy.allowedPhrases ?? [])
    politicalText = politicalText.replace(literalPattern(normalize(phrase)), '$1 ');
  if (builtIn && politics.test(politicalText)) reasons.push('Политическая тема');
  if ((policy.blockedWords ?? []).some((word) => literalPattern(normalize(word)).test(source)))
    reasons.push('Запрещённое слово встречи');
  return reasons;
}
