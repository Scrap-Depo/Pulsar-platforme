import { test, expect } from '@playwright/test';

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
  await expect(preview.getByText('Пример оформления с вымышленными ответами.', { exact: false })).toBeVisible();
  await expect(preview.getByText(/команда/i)).toBeVisible();
  await preview.getByLabel('Показать вымышленные ответы для примера').uncheck();
  await expect(preview.getByText(/команда/i)).toHaveCount(0);
  await preview.getByRole('button', { name: 'Экран участника' }).click();
  const link = await host.getByRole('link', { name: 'Вход участника' }).getAttribute('href');
  const projectorLink = await host
    .getByRole('link', { name: 'Открыть проектор' })
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
  await host.getByRole('button', { name: /^(Запустить вопрос|Задать вопрос повторно)$/, exact: true }).click();
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
    host.getByText('Присоединились: 2/100. Ответили на текущий вопрос: 2. Карточек: 2.'),
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
  await host.getByRole('button', { name: 'Заморозить проектор', exact: true }).click();
  await host.getByRole('tab', { name: 'Подготовка' }).click();
  await host
    .getByRole('button', { name: '3. Оцените текущее состояние по шкале от 1 до 10' })
    .click();
  await host.getByRole('button', { name: /^(Запустить вопрос|Задать вопрос повторно)$/, exact: true }).click();
  await expect(p.getByText('Выберите оценку от 1 до 10', { exact: true })).toBeVisible();
  await expect(p.getByRole('button', { name: 'Отправить', exact: true })).toBeDisabled();
  await expect(proj.getByText('Ответ другого участника', { exact: true })).toBeVisible();
  await proj.reload();
  await expect(proj.getByText('Ответ другого участника', { exact: true })).toBeVisible();
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
  await expect(host.getByRole('link', { name: 'Вход участника' })).toBeVisible();
  const url = host.url();
  await host.getByRole('textbox', { name: 'Вопрос', exact: true }).fill('Какой вариант выбрать?');
  await host.getByRole('combobox', { name: 'Вид результата', exact: true }).selectOption('donut');
  await host.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await expect(host.getByText('Есть несохранённые изменения.')).toHaveCount(0);
  await host.getByRole('button', { name: /^(Запустить вопрос|Задать вопрос повторно)$/, exact: true }).click();
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
    host.getByText('Присоединились: 1/100. Ответили на текущий вопрос: 1. Карточек: 1.'),
  ).toBeVisible();
  await host.getByRole('button', { name: 'Завершить сбор ответов', exact: true }).click();
  await host.getByRole('button', { name: 'Показать результаты', exact: true }).click();
  await expect(p.getByText('1 голосов', { exact: true })).toBeVisible();
  await expect(p.locator('body')).toHaveJSProperty('scrollWidth', 360);
  await host.getByRole('tab', { name: 'Подготовка' }).click();
  await host.getByRole('textbox', { name: 'Вопрос', exact: true }).fill('Новая формулировка');
  await host.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await expect(p.getByRole('heading', { name: 'Какой вариант выбрать?' }).first()).toBeVisible();
  await host.getByRole('button', { name: '4. Введите слово или короткую ассоциацию' }).click();
  await host.getByLabel('Показывать результаты сразу при сборе').check();
  await host.getByRole('button', { name: /^(Запустить вопрос|Задать вопрос повторно)$/, exact: true }).click();
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
