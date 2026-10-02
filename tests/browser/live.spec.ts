import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '@playwright/test';

// Examples are test fixtures, not content silently supplied to a new meeting.
async function prepareQuestionFixture(host: Page) {
  await expect(host.locator('.slide-card')).toHaveCount(1);
  const question = host.getByRole('textbox', { name: 'Вопрос', exact: true });
  await expect(question).toHaveValue('');
  await question.fill('Какой ваш главный приоритет на этот год?');
  await host.getByLabel('Вариант 1', { exact: true }).fill('Запуск нового продукта');
  await host.getByLabel('Вариант 2', { exact: true }).fill('Оптимизация расходов');
  await host.getByRole('button', { name: 'Добавить вариант', exact: true }).click();
  await host.getByLabel('Вариант 3', { exact: true }).fill('Найм новых сотрудников');
  await host.getByRole('button', { name: 'Добавить вариант', exact: true }).click();
  await host.getByLabel('Вариант 4', { exact: true }).fill('Выход на новые рынки');
  for (const [type, title] of [
    ['Открытые ответы', 'Главный инсайт квартала?'],
    ['Шкала', 'Оцените текущее состояние по шкале от 1 до 10'],
    ['Облако слов', 'Введите слово или короткую ассоциацию'],
  ]) {
    await host.getByRole('button', { name: type, exact: true }).click();
    await question.fill(title);
  }
  await host.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await host
    .getByRole('button', { name: '1. Какой ваш главный приоритет на этот год?', exact: true })
    .click();
}

async function saveQuestion(host: Page) {
  const save = host.getByRole('button', { name: 'Сохранить изменения', exact: true });
  if (await save.isEnabled()) await save.click();
}

test('question toolbar preserves edits, order and the saved meeting name', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const host = await context.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByLabel('Email', { exact: true }).fill(`toolbar-${Date.now()}@example.test`);
  await host.getByLabel('Пароль', { exact: true }).fill('test-password-toolbar');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  const today = await host.evaluate(() => {
    const date = new Date();
    return `Встреча ${new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date)} ${date.getFullYear()}`;
  });
  await host.getByRole('button', { name: 'Новая встреча', exact: true }).click();
  await prepareQuestionFixture(host);
  await expect(host.getByLabel('Название встречи', { exact: true })).toHaveValue(today);
  const cards = host.locator('.slide-card');
  const question = host.getByRole('textbox', { name: 'Вопрос', exact: true });
  await expect(cards).toHaveCount(4);
  await host.screenshot({ path: 'test-results/question-controls-laptop.png', fullPage: true });
  await expect(host.getByRole('button', { name: 'Поднять вопрос 1', exact: true })).toBeDisabled();
  await expect(host.getByRole('button', { name: 'Опустить вопрос 4', exact: true })).toBeDisabled();
  await host.getByLabel('Название встречи', { exact: true }).fill('Сохранённое название встречи');
  await question.fill('Проверка порядка вопросов');
  await host.getByLabel('Вариант 1', { exact: true }).fill('Сохранённый вариант');
  await host.getByRole('button', { name: 'Опустить вопрос 1', exact: true }).click();
  await expect(cards.nth(1).locator('.slide-select')).toHaveAttribute('aria-pressed', 'true');
  await expect(question).toHaveValue('Проверка порядка вопросов');
  await expect(host.getByLabel('Вариант 1', { exact: true })).toHaveValue('Сохранённый вариант');
  await host.getByRole('button', { name: 'Создать копию вопроса 2', exact: true }).click();
  await expect(cards).toHaveCount(5);
  await cards.nth(2).locator('.slide-select').click();
  await expect(question).toHaveValue('Проверка порядка вопросов копия');
  await expect(host.getByLabel('Вариант 1', { exact: true })).toHaveValue('Сохранённый вариант');
  await host.getByRole('button', { name: 'Удалить вопрос 1', exact: true }).click();
  await expect(question).toHaveValue('Проверка порядка вопросов копия');
  await expect(cards.nth(1).locator('.slide-select')).toHaveAttribute('aria-pressed', 'true');
  await host.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await host.reload();
  await expect(host.getByLabel('Название встречи', { exact: true })).toHaveValue(
    'Сохранённое название встречи',
  );
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0).locator('.slide-select')).toContainText('1. Проверка порядка вопросов');
  await expect(cards.nth(1).locator('.slide-select')).toContainText(
    '2. Проверка порядка вопросов копия',
  );
  await expect(question).toHaveValue('Проверка порядка вопросов копия');
  await host.getByRole('button', { name: 'Удалить вопрос 2', exact: true }).click();
  await expect(question).toHaveValue('Оцените текущее состояние по шкале от 1 до 10');
  while ((await cards.count()) > 1) {
    const lastIndex = await cards.count();
    await host.getByRole('button', { name: `Удалить вопрос ${lastIndex}`, exact: true }).click();
  }
  await expect(host.getByRole('button', { name: 'Удалить вопрос 1', exact: true })).toBeDisabled();
  await expect(host.getByRole('button', { name: 'Опустить вопрос 1', exact: true })).toBeDisabled();
  await host.setViewportSize({ width: 1024, height: 768 });
  await expect(host.locator('body')).toHaveJSProperty('scrollWidth', 1024);
  await host.setViewportSize({ width: 390, height: 844 });
  await expect(host.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await host.screenshot({ path: 'test-results/question-controls-mobile.png', fullPage: true });
  await context.close();
});

test('host, two mobile participants and independent frozen projector', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const errors: string[] = [];
  host.on('pageerror', (e) => errors.push(e.message));
  await host.goto('/');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByLabel('Email', { exact: true }).fill(`pilot-${Date.now()}@example.test`);
  await host.getByLabel('Пароль', { exact: true }).fill('test-password-123');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByRole('button', { name: 'Новая встреча', exact: true }).click();
  await prepareQuestionFixture(host);
  await expect(host.getByText('Код:', { exact: false })).toBeVisible();
  const preview = host.getByRole('region', { name: 'Предпросмотр выбранного вопроса' });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Отправить', exact: true })).toBeDisabled();
  await expect(host.getByRole('heading', { name: 'Сейчас на проекторе' })).toHaveCount(0);
  await preview.getByRole('button', { name: 'Экран проектора' }).click();
  await expect(preview.getByLabel('Показать вымышленные ответы для примера')).not.toBeChecked();
  await expect(preview.getByText('Предпросмотр без ответов.', { exact: false })).toBeVisible();
  await host.getByRole('button', { name: '4. Введите слово или короткую ассоциацию' }).click();
  await preview.getByRole('button', { name: 'Экран проектора' }).click();
  await expect(preview.getByText(/команда/i)).toHaveCount(0);
  await preview.getByLabel('Показать вымышленные ответы для примера').check();
  await expect(
    preview.getByText('Пример оформления с вымышленными ответами.', { exact: false }),
  ).toBeVisible();
  await expect(preview.getByText(/команда/i)).toBeVisible();
  await preview.getByLabel('Показать вымышленные ответы для примера').uncheck();
  await expect(preview.getByText(/команда/i)).toHaveCount(0);
  await preview.getByRole('button', { name: 'Экран участника' }).click();
  const link = await host.getByRole('link', { name: 'Вход участника' }).getAttribute('href');
  const projectorLink = await host
    .getByRole('link', { name: 'Открыть экран проектора' })
    .getAttribute('href');
  const pContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p2Context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const p = await pContext.newPage(),
    p2 = await p2Context.newPage();
  for (const page of [p, p2]) {
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(link!);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByText('Ожидаем первый вопрос ведущего.')).toBeVisible();
  }
  await host.getByRole('button', { name: '2. Главный инсайт квартала?' }).click();
  await host.getByLabel('Когда показывать результаты').selectOption('after');
  await saveQuestion(host);
  await host
    .getByRole('button', { name: /^(Запустить вопрос|Задать вопрос повторно)$/, exact: true })
    .click();
  await p.getByLabel('Ваш ответ', { exact: true }).fill('Черновик, который не должен пропасть');
  await p2.getByLabel('Ваш ответ', { exact: true }).fill('Ответ другого участника');
  await p2.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(p2.getByText('Ответ принят.', { exact: true })).toBeVisible();
  await expect(p.getByLabel('Ваш ответ', { exact: true })).toHaveValue(
    'Черновик, который не должен пропасть',
  );
  await p.reload();
  await p.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(p.getByLabel('Ваш ответ', { exact: true })).toHaveValue(
    'Черновик, который не должен пропасть',
  );
  await p.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(p.getByText('Ответ принят.', { exact: true })).toBeVisible();
  await expect(
    host.getByText('Ответили 2 из 2 присоединившихся. Присоединились: 2/100.'),
  ).toBeVisible();
  await expect(p.getByText('Ответ другого участника', { exact: true })).toHaveCount(0);
  await host.getByRole('button', { name: 'Одобрить', exact: true }).first().click();
  await expect(host.getByRole('button', { name: 'Одобрить', exact: true })).toHaveCount(1);
  await host.getByRole('button', { name: 'Одобрить', exact: true }).click();
  await host.getByRole('button', { name: 'Завершить сбор ответов', exact: true }).click();
  await host.getByRole('button', { name: 'Показать результаты', exact: true }).click();
  await expect(p.getByText('Ответ другого участника', { exact: true })).toBeVisible();
  const projContext = await browser.newContext();
  const proj = await projContext.newPage();
  await proj.goto(projectorLink!);
  await expect(proj.getByText('Ответ другого участника', { exact: true })).toBeVisible();
  await host.getByText('Показ и оформление результатов', { exact: true }).click();
  await host.getByRole('button', { name: 'Заморозить проектор', exact: true }).click();
  await host.getByRole('tab', { name: 'Подготовка' }).click();
  await host
    .getByRole('button', { name: '3. Оцените текущее состояние по шкале от 1 до 10' })
    .click();
  await host.getByLabel('Когда показывать результаты').selectOption('after');
  await saveQuestion(host);
  await host
    .getByRole('button', { name: /^(Запустить вопрос|Задать вопрос повторно)$/, exact: true })
    .click();
  await expect(p.getByText('Выберите оценку от 1 до 10', { exact: true })).toBeVisible();
  const frozenStage = host.getByRole('region', { name: 'Текущий вопрос и результаты' });
  await expect(
    frozenStage.getByRole('heading', {
      name: 'Оцените текущее состояние по шкале от 1 до 10',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    frozenStage.getByRole('heading', { name: 'Главный инсайт квартала?', exact: true }),
  ).toBeVisible();
  await expect(p.getByRole('button', { name: 'Отправить', exact: true })).toBeDisabled();
  await expect(proj.getByText('Ответ другого участника', { exact: true })).toBeVisible();
  await proj.reload();
  await expect(proj.getByText('Ответ другого участника', { exact: true })).toBeVisible();
  await host.getByText('Показ и оформление результатов', { exact: true }).click();
  await host.getByRole('button', { name: 'Снять заморозку', exact: true }).click();
  await expect(proj.getByText('Ответ другого участника', { exact: true })).toHaveCount(0);
  await p.getByRole('button', { name: '7', exact: true }).click();
  await pContext.setOffline(true);
  await expect(p.getByRole('button', { name: 'Отправить', exact: true })).toBeDisabled();
  await pContext.setOffline(false);
  await p.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(p.getByText('Ответ принят.', { exact: true })).toBeVisible();
  await host.getByRole('button', { name: 'Завершить сбор ответов', exact: true }).click();
  await host.getByRole('button', { name: 'Показать результаты', exact: true }).click();
  await expect(p.getByText('Среднее по аудитории', { exact: true })).toBeVisible();
  await expect(p.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await host.screenshot({ path: 'test-results/host.png', fullPage: true });
  await p.screenshot({ path: 'test-results/participant.png', fullPage: true });
  await host.getByText('Завершение встречи', { exact: true }).click();
  host.once('dialog', (d) => d.accept());
  await host.getByRole('button', { name: 'Завершить встречу', exact: true }).click();
  await expect(p.getByText('Встреча завершена. Спасибо за участие.')).toBeVisible();
  await host.getByRole('tab', { name: 'История' }).click();
  const download = host.waitForEvent('download');
  await host.getByRole('button', { name: 'Скачать результаты JSON' }).click();
  expect((await download).suggestedFilename()).toMatch(/pulsar-.*\.json/);
  expect(errors).toEqual([]);
  await Promise.all([
    hostContext.close(),
    pContext.close(),
    p2Context.close(),
    projContext.close(),
  ]);
});

test('saved editor, vote changes, reviewed cloud, host recovery and deletion', async ({
  browser,
}) => {
  const hc = await browser.newContext();
  const host = await hc.newPage();
  const email = `host-${Date.now()}@example.test`,
    password = 'test-password-456';
  await host.goto('/');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByLabel('Email', { exact: true }).fill(email);
  await host.getByLabel('Пароль', { exact: true }).fill(password);
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByRole('button', { name: 'Новая встреча', exact: true }).click();
  await prepareQuestionFixture(host);
  await expect(host.getByRole('link', { name: 'Вход участника' })).toBeVisible();
  const url = host.url();
  await host.getByRole('textbox', { name: 'Вопрос', exact: true }).fill('Какой вариант выбрать?');
  await host.getByText('Оформление результатов', { exact: true }).click();
  await host.getByRole('combobox', { name: 'Вид результата', exact: true }).selectOption('donut');
  await host.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await expect(host.getByText('Есть несохранённые изменения.', { exact: false })).toHaveCount(0);
  await host.getByLabel('Когда показывать результаты').selectOption('after');
  await saveQuestion(host);
  await host
    .getByRole('button', { name: /^(Запустить вопрос|Задать вопрос повторно)$/, exact: true })
    .click();
  const pc = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const p = await pc.newPage();
  await p.goto((await host.getByRole('link', { name: 'Вход участника' }).getAttribute('href'))!);
  await p.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(p.getByRole('heading', { name: 'Какой вариант выбрать?' }).first()).toBeVisible();
  await p.getByRole('radio').first().check();
  await p.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(p.getByText('Ответ принят.', { exact: true })).toBeVisible();
  await p.getByRole('radio').nth(1).check();
  await p.getByRole('button', { name: 'Сохранить изменение' }).click();
  await expect(
    host.getByText('Ответили 1 из 1 присоединившихся. Присоединились: 1/100.'),
  ).toBeVisible();
  await host.getByRole('button', { name: 'Завершить сбор ответов', exact: true }).click();
  await host.getByRole('button', { name: 'Показать результаты', exact: true }).click();
  await expect(p.getByText('1 голосов', { exact: true })).toBeVisible();
  await expect(p.locator('body')).toHaveJSProperty('scrollWidth', 360);
  await host.getByRole('tab', { name: 'Подготовка' }).click();
  await host.getByRole('textbox', { name: 'Вопрос', exact: true }).fill('Новая формулировка');
  await host.getByRole('tab', { name: 'Эфир' }).click();
  await expect(
    host.getByText('В подготовке есть несохранённые изменения.', { exact: false }),
  ).toBeVisible();
  await expect(p.getByRole('heading', { name: 'Какой вариант выбрать?' }).first()).toBeVisible();
  await host.getByRole('button', { name: 'Вернуться к изменениям', exact: true }).click();
  await expect(host.getByRole('textbox', { name: 'Вопрос', exact: true })).toHaveValue(
    'Новая формулировка',
  );
  await host.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await expect(p.getByRole('heading', { name: 'Какой вариант выбрать?' }).first()).toBeVisible();
  await host.getByRole('button', { name: '4. Введите слово или короткую ассоциацию' }).click();
  await host.getByLabel('Когда показывать результаты').selectOption('immediate');
  await saveQuestion(host);
  await host
    .getByRole('button', { name: /^(Запустить вопрос|Задать вопрос повторно)$/, exact: true })
    .click();
  await p.getByLabel('Ваш ответ', { exact: true }).fill('а'.repeat(41));
  await expect(p.getByRole('button', { name: 'Отправить', exact: true })).toBeDisabled();
  await p.getByLabel('Ваш ответ', { exact: true }).fill('Вдохновение');
  await p.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(p.getByText('Ожидает одобрения перед публикацией.')).toBeVisible();
  await host.getByRole('button', { name: 'Одобрить', exact: true }).click();
  await expect(p.getByText('вдохновение', { exact: false }).last()).toBeVisible();
  await p.getByLabel('Ваш ответ', { exact: true }).fill('Рост');
  await p.getByRole('button', { name: 'Сохранить изменение' }).click();
  await expect(host.getByRole('button', { name: 'Одобрить', exact: true })).toBeVisible();
  await expect(p.getByText('Опубликованных ответов пока нет.')).toBeVisible();
  await host.getByRole('button', { name: 'Выйти', exact: false }).click();
  await host.getByLabel('Email', { exact: true }).fill(email);
  await host.getByLabel('Пароль', { exact: true }).fill(password);
  await host.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(host.getByRole('link', { name: 'Вход участника' })).toBeVisible();
  expect(host.url()).toBe(url);
  const link = (await host.getByRole('link', { name: 'Вход участника' }).getAttribute('href'))!;
  const code = new URL(link).searchParams.get('code')!;
  await host.getByRole('tab', { name: 'История' }).click();
  await host.getByText('Удалить встречу и все ответы', { exact: true }).click();
  await host.getByLabel('Код для удаления', { exact: true }).fill(code);
  await host.getByRole('button', { name: 'Удалить встречу', exact: true }).click();
  await expect(host.getByRole('heading', { name: 'Мои встречи' })).toBeVisible();
  await expect(
    p.getByText(/Встреча завершена|Встреча удалена|Нет доступа к данным/).first(),
  ).toBeVisible();
  await p.goto('/participant');
  await p.getByLabel('Код встречи', { exact: true }).fill('BADCODE');
  await p.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(p.getByRole('alert')).toContainText('Код не найден');
  await Promise.all([hc.close(), pc.close()]);
});

test('preparation settings, live controls and repeat launch are clear on a laptop', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const host = await context.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByLabel('Email', { exact: true }).fill(`ux-${Date.now()}@example.test`);
  await host.getByLabel('Пароль', { exact: true }).fill('test-password-789');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByRole('button', { name: 'Новая встреча', exact: true }).click();
  await prepareQuestionFixture(host);
  await expect(host.getByRole('heading', { name: 'Вопросы', exact: true })).toBeVisible();
  await expect(host.getByLabel('Карточек на участника')).toHaveCount(0);
  await expect(host.getByLabel('Одобрять свободный текст перед публикацией')).toHaveCount(0);
  await host.getByRole('tab', { name: 'Эфир' }).click();
  await expect(host.getByRole('progressbar')).toHaveCount(0);
  await expect(host.getByRole('button', { name: 'Заморозить проектор' })).toHaveCount(0);
  await host.getByRole('button', { name: 'Выбрать вопрос' }).click();
  await host.getByRole('button', { name: '2. Главный инсайт квартала?' }).click();
  await expect(host.getByLabel('Карточек на участника')).toBeVisible();
  await expect(host.getByLabel('Одобрять свободный текст перед публикацией')).toBeVisible();
  await host
    .getByRole('button', { name: '3. Оцените текущее состояние по шкале от 1 до 10' })
    .click();
  await expect(host.getByLabel('Карточек на участника')).toHaveCount(0);
  await expect(host.getByLabel('Одобрять свободный текст перед публикацией')).toHaveCount(0);
  await host.getByRole('button', { name: '4. Введите слово или короткую ассоциацию' }).click();
  await expect(host.getByLabel('Карточек на участника')).toHaveCount(0);
  await expect(host.getByLabel('Одобрять свободный текст перед публикацией')).toBeVisible();
  await host.getByRole('button', { name: '1. Какой ваш главный приоритет на этот год?' }).click();
  await host.getByLabel('Название встречи', { exact: true }).fill('Проверка интерфейса');
  await host
    .getByRole('textbox', { name: 'Вопрос', exact: true })
    .fill('Что важно проверить перед запуском встречи?');
  await expect(host.getByRole('button', { name: 'Запустить вопрос', exact: true })).toBeDisabled();
  await expect(
    host.getByText('Есть несохранённые изменения. Сохраните перед запуском.', { exact: true }),
  ).toBeVisible();
  await host.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await host.getByLabel('Когда показывать результаты').selectOption('after');
  await saveQuestion(host);
  await host.screenshot({ path: 'test-results/preparation-laptop.png', fullPage: true });
  await host.getByRole('button', { name: 'Запустить вопрос', exact: true }).click();
  await expect(host.getByText('Вопрос запущен. Участники могут отвечать.')).toBeVisible();
  await expect(host.getByText('Результаты скрыты от участников')).toBeVisible();
  await expect(host.getByText('Участники ещё не подключились.')).toBeVisible();
  await expect(host.getByRole('progressbar')).toHaveCount(0);
  await expect(host.getByRole('button', { name: 'Открыть лайки' })).toHaveCount(0);
  const close = host.getByRole('button', { name: 'Завершить сбор ответов' });
  const stage = host.getByRole('region', { name: 'Текущий вопрос и результаты' });
  const closeBox = (await close.boundingBox())!;
  const stageBox = (await stage.boundingBox())!;
  expect(closeBox.y + closeBox.height).toBeLessThan(720);
  expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(closeBox.x);
  await host.screenshot({ path: 'test-results/live-laptop.png', fullPage: true });
  await expect(
    host.getByRole('button', { name: 'Заморозить проектор', exact: true }),
  ).toBeVisible();
  const connection = host.locator('details.participant-connection');
  await expect(connection).toHaveAttribute('open', '');
  await connection.locator('summary').click();
  await expect(connection).not.toHaveAttribute('open', '');
  await host.getByRole('tab', { name: 'Подготовка' }).click();
  await expect(host.getByText('Вопрос запущен. Участники могут отвечать.')).toHaveCount(0);
  await expect(host.getByRole('button', { name: 'Перейти в эфир', exact: true })).toBeEnabled();
  await expect(
    host.getByRole('button', { name: 'Задать вопрос повторно', exact: true }),
  ).not.toBeVisible();
  await host.getByText('Начать новый сбор на этот вопрос', { exact: true }).click();
  host.once('dialog', (dialog) => void dialog.dismiss());
  await host.getByRole('button', { name: 'Задать вопрос повторно', exact: true }).click();
  await expect(host.getByRole('button', { name: 'Перейти в эфир', exact: true })).toBeVisible();
  await host.getByText('Начать новый сбор на этот вопрос', { exact: true }).click();
  await host.getByRole('textbox', { name: 'Вопрос', exact: true }).fill('Несохранённая редакция');
  await expect(
    host.getByText('В эфире сохранённая при запуске версия;', { exact: false }),
  ).toBeVisible();
  await host.getByRole('button', { name: 'Перейти в эфир', exact: true }).click();
  await expect(
    stage.getByRole('heading', {
      name: 'Что важно проверить перед запуском встречи?',
      exact: true,
    }),
  ).toHaveCount(1);
  await host.getByRole('tab', { name: 'История' }).click();
  await expect(host.getByLabel('История запусков вопросов').locator('option')).toHaveCount(2);
  await host.getByRole('tab', { name: 'Подготовка' }).click();
  host.once('dialog', (dialog) => void dialog.accept());
  await host.getByRole('button', { name: 'Отменить изменения', exact: true }).click();
  await host.getByRole('button', { name: 'Перейти в эфир', exact: true }).click();
  await expect(connection).toHaveAttribute('open', '');
  await host.getByText('Таймер (необязательно)', { exact: true }).click();
  await host.getByLabel('Таймер, секунд').fill('1');
  await host.getByRole('button', { name: 'Запустить таймер' }).click();
  await host.getByText('Таймер (необязательно)', { exact: true }).click();
  await expect(
    host.getByRole('button', { name: 'Запустить таймер', exact: true }),
  ).not.toBeVisible();
  await expect(host.getByText('Время истекло.', { exact: false })).toBeVisible();
  await expect(host.getByRole('button', { name: 'Убрать таймер', exact: true })).toBeVisible();
  await expect(close).toBeVisible();
  await host.getByText('Показ и оформление результатов', { exact: true }).click();
  await host.getByRole('combobox', { name: 'Вид результата', exact: true }).selectOption('donut');
  await expect(host.getByText('Вид результатов обновлён.')).toBeVisible();
  await expect(host.getByRole('combobox', { name: 'Вид результата', exact: true })).toHaveValue(
    'donut',
  );
  await close.click();
  await host.getByRole('button', { name: 'Показать результаты', exact: true }).click();
  await host.getByRole('button', { name: 'Следующий вопрос', exact: true }).click();
  await expect(host.getByRole('textbox', { name: 'Вопрос', exact: true })).toHaveValue(
    'Главный инсайт квартала?',
  );
  await expect(
    host.getByRole('button', { name: '2. Главный инсайт квартала?', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(host.getByRole('button', { name: 'Запустить вопрос', exact: true })).toBeVisible();
  await host
    .getByRole('button', { name: '1. Что важно проверить перед запуском встречи?', exact: true })
    .click();
  let confirmations = 0;
  host.once('dialog', (dialog) => {
    confirmations++;
    void dialog.accept();
  });
  await host.getByRole('button', { name: 'Задать вопрос повторно', exact: true }).click();
  await expect(close).toBeVisible();
  expect(confirmations).toBe(1);
  await host.setViewportSize({ width: 390, height: 844 });
  await expect(host.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await host.getByText('Завершение встречи', { exact: true }).click();
  host.once('dialog', (dialog) => void dialog.accept());
  await host.getByRole('button', { name: 'Завершить встречу', exact: true }).click();
  await host.getByRole('tab', { name: 'История' }).click();
  await expect(host.getByLabel('История запусков вопросов').locator('option')).toHaveCount(3);
  await context.close();
});

test('blank drafts save safely and launch settings belong to each question', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const host = await context.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByLabel('Email', { exact: true }).fill(`draft-${Date.now()}@example.test`);
  await host.getByLabel('Пароль', { exact: true }).fill('test-password-draft');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByRole('button', { name: 'Новая встреча', exact: true }).click();
  const title = host.getByRole('textbox', { name: 'Вопрос', exact: true });
  const launch = host.getByRole('button', { name: 'Запустить вопрос', exact: true });
  await expect(host.locator('.slide-card')).toHaveCount(1);
  await expect(title).toHaveValue('');
  await expect(launch).toBeDisabled();
  await host.getByLabel('Название встречи', { exact: true }).fill('Сохранённый пустой черновик');
  await saveQuestion(host);
  await host.reload();
  await expect(host.getByLabel('Название встречи', { exact: true })).toHaveValue(
    'Сохранённый пустой черновик',
  );
  await expect(title).toHaveValue('');
  await expect(launch).toBeDisabled();
  await title.fill('Выберите направление');
  await host.getByLabel('Вариант 1', { exact: true }).fill('Рост');
  await host.getByLabel('Вариант 2', { exact: true }).fill(' рост ');
  await saveQuestion(host);
  await expect(launch).toBeDisabled();
  await host.getByLabel('Вариант 2', { exact: true }).fill('Поддержка');
  await host.getByLabel('Когда показывать результаты').selectOption('after');
  await saveQuestion(host);
  await expect(launch).toBeEnabled();
  await host.getByRole('button', { name: 'Открытые ответы', exact: true }).click();
  await title.fill('Что поможет команде?');
  await expect(host.getByLabel('Одобрять свободный текст перед публикацией')).toBeChecked();
  await expect(host.getByLabel('Когда показывать результаты')).toHaveValue('immediate');
  await host.getByLabel('Карточек на участника').selectOption('3');
  await host.getByLabel('Одобрять свободный текст перед публикацией').uncheck();
  await saveQuestion(host);
  await host.getByRole('button', { name: '1. Выберите направление', exact: true }).click();
  await expect(host.getByLabel('Когда показывать результаты')).toHaveValue('after');
  await host.reload();
  await host.getByRole('button', { name: '1. Выберите направление', exact: true }).click();
  await expect(host.getByLabel('Когда показывать результаты')).toHaveValue('after');
  await host.getByRole('button', { name: '2. Что поможет команде?', exact: true }).click();
  await expect(host.getByLabel('Карточек на участника')).toHaveValue('3');
  await expect(host.getByLabel('Одобрять свободный текст перед публикацией')).not.toBeChecked();
  await expect(host.getByLabel('Когда показывать результаты')).toHaveValue('immediate');
  await title.fill('');
  await saveQuestion(host);
  await host.reload();
  await expect(title).toHaveValue('');
  await expect(host.getByRole('button', { name: '2. Без названия', exact: true })).toBeVisible();
  await expect(launch).toBeDisabled();
  await context.close();
});

test('history charts use reviewed text and closed question exports work during a live meeting', async ({
  browser,
}) => {
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  await host.goto('/');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByLabel('Email', { exact: true }).fill(`history-${Date.now()}@example.test`);
  await host.getByLabel('Пароль', { exact: true }).fill('test-password-history');
  await host.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await host.getByRole('button', { name: 'Новая встреча', exact: true }).click();
  await host.getByRole('button', { name: 'Открытые ответы', exact: true }).click();
  await host.getByRole('textbox', { name: 'Вопрос', exact: true }).fill('Что обсудим?');
  await saveQuestion(host);
  await host.getByRole('button', { name: 'Запустить вопрос', exact: true }).click();
  const link = (await host.getByRole('link', { name: 'Вход участника' }).getAttribute('href'))!;
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();
  for (const [page, answer] of [
    [first, 'Исходная формулировка'],
    [second, 'Скрытый ответ'],
  ] as const) {
    await page.goto(link);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.getByLabel('Ваш ответ', { exact: true }).fill(answer);
    await page.getByRole('button', { name: 'Отправить', exact: true }).click();
    await expect(page.getByText('Ответ принят.', { exact: true })).toBeVisible();
  }
  const editedCard = host
    .locator('article')
    .filter({ has: host.getByText('Исходная формулировка', { exact: true }) });
  await editedCard.getByRole('button', { name: 'Редактировать с пометкой', exact: true }).click();
  await host
    .getByRole('textbox', { name: 'Редакция ведущего', exact: true })
    .fill('Проверенная формулировка');
  await host.getByRole('button', { name: 'Сохранить редакцию', exact: true }).click();
  const hiddenCard = host
    .locator('article')
    .filter({ has: host.getByText('Скрытый ответ', { exact: true }) });
  await hiddenCard.getByRole('button', { name: 'Одобрить', exact: true }).click();
  await hiddenCard.getByRole('button', { name: 'Скрыть', exact: true }).click();
  await host.getByRole('tab', { name: 'История' }).click();
  const history = host.getByLabel('История запусков вопросов');
  await expect(history.locator('option')).toHaveCount(2);
  await history.selectOption({ index: 1 });
  await expect(
    host.getByRole('button', { name: 'Скачать ответы вопроса CSV', exact: true }),
  ).toBeDisabled();
  await host.getByRole('tab', { name: 'Эфир' }).click();
  await host.getByRole('button', { name: 'Завершить сбор ответов', exact: true }).click();
  await host.getByRole('tab', { name: 'История' }).click();
  const chart = host.getByRole('region', { name: 'Итоги выбранного вопроса', exact: true });
  await expect(chart.getByText('Проверенная формулировка', { exact: true })).toBeVisible();
  await expect(chart.getByText('Исходная формулировка', { exact: true })).toHaveCount(0);
  await expect(chart.getByText('Скрытый ответ', { exact: true })).toHaveCount(0);
  await expect(
    host.getByText('Одобрено: 1. Скрыто: 1. На проверке: 0.', { exact: true }),
  ).toBeVisible();
  await host.getByText('Все ответы (видны только ведущему)', { exact: true }).click();
  await expect(host.getByText('Скрытый ответ — скрыто', { exact: false })).toBeVisible();
  const download = host.waitForEvent('download');
  await host.getByRole('button', { name: 'Скачать ответы вопроса CSV', exact: true }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toMatch(/pulsar-.*\.csv/);
  const csv = await readFile((await exported.path())!, 'utf8');
  expect(csv).toContain('Проверенная формулировка');
  expect(csv).toContain('Исходная формулировка');
  expect(csv).toContain('Скрытый ответ');
  await host.screenshot({ path: '/private/tmp/pulsar-history-desktop.png', fullPage: true });
  await host.setViewportSize({ width: 390, height: 844 });
  await expect(host.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await host.screenshot({ path: '/private/tmp/pulsar-history-mobile.png', fullPage: true });
  await Promise.all([hostContext.close(), firstContext.close(), secondContext.close()]);
});
