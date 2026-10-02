import { useState } from 'react';
import { SessionSlide } from '../shared/types/common';
import { PublicResponse, Round, RoundSettings } from '../shared/types/live';
import LiveResults from './LiveResults';

export default function QuestionPreview({ slide, settings }: { slide: SessionSlide; settings: RoundSettings }) {
  const [screen, setScreen] = useState<'participant' | 'projector'>('participant');
  const [showExamples, setShowExamples] = useState(false);
  const round: Round = {
    id: 'preview', slide, settings, phase: 'open', visible: showExamples || settings.immediate, likesOpen: false, deadline: null,
  };
  const values: Array<string | number> = slide.type === 'multiple-choice'
    ? slide.options.flatMap((option, i) => Array.from({ length: i + 1 }, () => option.id))
    : slide.type === 'pulse' ? [3, 5, 7, 7, 8]
    : slide.type === 'word-cloud' ? ['Команда', 'Развитие', 'Команда', 'Поддержка']
    : ['Пример первого ответа', 'Пример второго ответа'];
  const examples: PublicResponse[] = values.map((value, i) => ({
    id: `preview-${i}`, type: slide.type, value, edited: false, likes: 0, revision: 1,
  }));
  return (
    <section className="question-preview section-stack" aria-label="Предпросмотр выбранного вопроса">
      <h3>Предпросмотр</h3>
      <div className="button-row" role="group" aria-label="Экран предпросмотра">
        <button type="button" aria-pressed={screen === 'participant'} onClick={() => setScreen('participant')}>Экран участника</button>
        <button type="button" aria-pressed={screen === 'projector'} onClick={() => setScreen('projector')}>Экран проектора</button>
      </div>
      {screen === 'projector' ? (
        <>
          <label className="choice">
            <input type="checkbox" checked={showExamples} onChange={(e) => setShowExamples(e.target.checked)} />
            Показать вымышленные ответы для примера
          </label>
          {showExamples ? (
            <p role="status">Пример оформления с вымышленными ответами. Это не результаты встречи; они не сохраняются и не показываются участникам.</p>
          ) : <p>Предпросмотр без ответов. Настоящие результаты доступны в разделе «Сейчас на проекторе» после запуска вопроса.</p>}
          <p>{settings.immediate ? 'Результаты будут появляться при сборе ответов.' : 'До команды «Показать результаты» участники будут видеть только вопрос и статус сбора.'}</p>
          <LiveResults round={round} results={showExamples ? examples : []} />
        </>
      ) : (
        <div className="card response-form">
          <h2>{slide.title || 'Введите вопрос'}</h2>
          <fieldset disabled aria-label="Пример формы участника">
            {slide.type === 'multiple-choice' && slide.options.map(option => (
              <label className="choice" key={option.id}>
                <input type="radio" name="preview-choice" />{option.text}
              </label>
            ))}
            {slide.type === 'pulse' && (
              <>
                <p>Выберите оценку от 1 до 10</p>
                <div className="pulse-buttons">{Array.from({ length: 10 }, (_, i) => <button type="button" key={i}>{i + 1}</button>)}</div>
                <p>1 — {slide.minLabel}. 10 — {slide.maxLabel}.</p>
              </>
            )}
            {slide.type === 'open-answers' && (
              <>
                {settings.cardLimit === 3 && <div className="button-row">{[1, 2, 3].map(i => <button type="button" key={i}>Карточка {i}</button>)}</div>}
                <label>Ваш ответ<textarea rows={3} placeholder="До 300 символов" /></label>
              </>
            )}
            {slide.type === 'word-cloud' && <label>Слово или короткая фраза<input placeholder="До 40 символов" /></label>}
            <button type="button">Отправить</button>
          </fieldset>
          <p>Ответы не отправляются.</p>
        </div>
      )}
    </section>
  );
}
