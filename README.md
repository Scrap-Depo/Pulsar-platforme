# Пульсар

Стартовый каркас приложения для интерактивных экранов, голосований и проекторных режимов.

## Запуск

```bash
npm install
npm run dev
```

## Деплой

Проект готов к деплою на Vercel как SPA-приложение на Vite.

Базовые настройки:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

После подключения GitHub-репозитория к Vercel каждый push в ветку `main` будет автоматически запускать новый production deploy.

## Структура

- `src/app` — корневые файлы приложения
- `src/pages` — крупные экраны
- `src/features` — продуктовые модули
- `src/widgets` — составные части интерфейса
- `src/shared` — общие компоненты, хуки и утилиты
