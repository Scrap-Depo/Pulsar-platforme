// Heuristics for review, not a classifier of intent or political opinions.
// Keep this list on the server: clients must not bypass the publication gate.
const profanity =
  /^(?:бля(?:д[а-я]*|ть|ха)?|бляд[а-я]*|(?:за|на|по|вы|от|до|про|раз|рас|с|долбо)?(?:е|ё)б[а-я]*|(?:на|по|за|ни|о)?ху[йяеёию][а-я]*|(?:по|до|на|за|вы)?пизд[а-я]*|мудак[а-я]*|мудил[а-я]*)$/u;
const spacedProfanity =
  /(?:^|[^\p{L}])(?:х[\s.*_\-]+у[\s.*_\-]+й|б[\s.*_\-]+л[\s.*_\-]+я[\s.*_\-]+д[\s.*_\-]+ь)(?=$|[^\p{L}])/u;
const threat =
  /(?:террор(?:изм|ист|истическ)|теракт|взорв(?:ать|ём|ем|у)|(?:убить|расстрелять|подорвать)\s+(?:людей|человека|школу|толпу)|(?:сделать|собрать|изготовить)\s+бомб)/u;
const politics =
  /(?:^|[^\p{L}])(?:политик[а-я]*|выбор[ыа]|президент[а-я]*|парламент[а-я]*|путин[а-я]*|зеленск[а-я]*|навальн[а-я]*|митинг[а-я]*|санкци[а-я]*)(?=$|[^\p{L}])/u;

export function filterReasons(value) {
  if (typeof value !== 'string') return [];
  const source = value.normalize('NFKC').toLocaleLowerCase('ru-RU');
  const tokens = source.match(/[\p{L}]+/gu) ?? [];
  // Also catch common spacing/punctuation evasions inside a short swear word.
  const joined = source.replace(/(?<=\p{L})[.*_\-\s]+(?=\p{L})/gu, '');
  const reasons = [];
  if (
    tokens.some((word) => profanity.test(word)) ||
    profanity.test(joined) ||
    spacedProfanity.test(source)
  )
    reasons.push('Нецензурная лексика');
  if (threat.test(source)) reasons.push('Терроризм или угрозы насилия');
  if (politics.test(source)) reasons.push('Политическая тема');
  return reasons;
}
