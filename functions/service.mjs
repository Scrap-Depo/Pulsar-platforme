import {
  validSlide,
  responseValue,
  responseId,
  publicResponse,
  ownResponse,
  launchSettings,
  launchProblem,
  joinCode,
  text,
  fail,
} from './domain.mjs';
import { filterReasons, contentPolicy } from './content-filter.mjs';

const now = () => new Date().toISOString();
const value = (snap) => (snap.exists ? snap.data() : null);
const required = (snap, message) => value(snap) ?? fail(message);
const owner = (meeting, uid) => {
  if (meeting.ownerUid !== uid) fail('Нет доступа ведущего.');
};
const active = (meeting) => {
  if (['finished', 'deleting'].includes(meeting.status)) fail('Встреча завершена или удаляется.');
};
function publicRound(round) {
  if (!round) return null;
  return {
    id: round.id,
    slide: round.slide,
    phase: round.phase,
    visible: round.visible,
    settings: round.settings,
    likesOpen: round.likesOpen,
    deadline: round.deadline ?? null,
  };
}

export function createService(db, onSubmitTiming = () => {}) {
  return async function execute(uid, provider, input) {
    if (!uid) fail('Войдите в приложение.');
    if (!input || typeof input.action !== 'string') fail('Неизвестное действие.');
    const { action } = input;
    if (action === 'filterTemplates') {
      if (!['password', 'google.com'].includes(provider))
        fail('Войдите в аккаунт ведущего для работы с наборами фильтра.');
      const ref = db.doc(`hostFilterTemplates/${uid}`);
      if (input.operation === 'list')
        return { templates: (await ref.get()).data()?.templates ?? [] };
      if (!['save', 'delete'].includes(input.operation)) fail('Неизвестное действие с набором.');
      const id = text(input.id, 100, 'ID набора');
      if (!/^[a-zA-Z0-9-]+$/.test(id)) fail('Некорректный ID набора.');
      return db.runTransaction(async (tx) => {
        const templates = (await tx.get(ref)).data()?.templates ?? [];
        let updated;
        if (input.operation === 'delete') {
          if (!templates.some((t) => t.id === id)) fail('Набор уже удалён. Обновите список.');
          updated = templates.filter((t) => t.id !== id);
        } else {
          const name = text(input.name, 80, 'Название набора');
          const key = name.normalize('NFKC').toLocaleLowerCase('ru-RU');
          const existing = templates.find(
            (t) => t.name.normalize('NFKC').toLocaleLowerCase('ru-RU') === key,
          );
          const entry = {
            id: existing?.id ?? id,
            name,
            ...contentPolicy(input.policy),
            updatedAt: now(),
          };
          updated = [...templates.filter((t) => t.id !== entry.id), entry];
          if (updated.length > 20) fail('Можно сохранить до 20 наборов. Удалите ненужный.');
        }
        tx.set(ref, { templates: updated });
        return { templates: updated };
      });
    }
    if (action === 'create') {
      if (!['password', 'google.com'].includes(provider))
        fail('Для создания встречи войдите в аккаунт ведущего.');
      const sid = text(input.requestId, 100, 'ID встречи');
      if (!/^[a-zA-Z0-9-]+$/.test(sid)) fail('Некорректный ID встречи.');
      const slides = (input.slides ?? []).map(validSlide);
      if (!slides.length || slides.length > 50) fail('Нужно от 1 до 50 слайдов.');
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = joinCode();
        const result = await db.runTransaction(async (tx) => {
          const mref = db.doc(`meetings/${sid}`),
            cref = db.doc(`joinCodes/${code}`);
          const [old, reserved] = await tx.getAll(mref, cref);
          if (old.exists) {
            owner(old.data(), uid);
            return { id: sid, joinCode: old.data().joinCode };
          }
          if (reserved.exists) return null;
          const meeting = {
            id: sid,
            ownerUid: uid,
            title: text(input.title || 'Новая встреча', 150),
            joinCode: code,
            status: 'draft',
            slides,
            currentSlideId: slides[0].id,
            liveSlideId: null,
            roundId: null,
            version: 1,
            createdAt: now(),
            retention: 'until-owner-deletes',
            contentPolicy: contentPolicy(),
          };
          tx.create(mref, meeting);
          tx.create(cref, { sessionId: sid });
          tx.create(db.doc(`rooms/${sid}`), {
            title: meeting.title,
            status: 'draft',
            round: null,
            frozen: null,
            joinedCount: 0,
          });
          return { id: sid, joinCode: code };
        });
        if (result) return result;
      }
      fail('Не удалось подобрать код. Повторите создание.');
    }
    if (action === 'previewMeeting') {
      const code = text(input.code, 30, 'Код').replace(/\s/g, '').toUpperCase();
      if (!/^[A-Z0-9]{6,10}$/.test(code)) fail('Проверьте код встречи.');
      const resolved = required(
        await db.doc(`joinCodes/${code}`).get(),
        'Встреча по этому коду не найдена.',
      );
      const meeting = required(
        await db.doc(`meetings/${resolved.sessionId}`).get(),
        'Встреча не найдена.',
      );
      if (meeting.joinCode !== code || ['finished', 'deleting'].includes(meeting.status))
        fail('Встреча завершена или недоступна.');
      return { title: meeting.title, code };
    }
    if (action === 'join') {
      const code = text(input.code, 30, 'Код').replace(/\s/g, '').toUpperCase();
      if (!/^[A-Z0-9]{6,10}$/.test(code)) fail('Проверьте код встречи.');
      return db.runTransaction(async (tx) => {
        const resolved = required(
          await tx.get(db.doc(`joinCodes/${code}`)),
          'Код не найден. Проверьте ссылку или введите другой код.',
        );
        const sid = resolved.sessionId;
        const mref = db.doc(`meetings/${sid}`),
          memberRef = db.doc(`meetings/${sid}/${input.viewer ? 'viewers' : 'members'}/${uid}`);
        const [msnap, existing, members] = await Promise.all([
          tx.get(mref),
          tx.get(memberRef),
          tx.get(db.collection(`meetings/${sid}/members`)),
        ]);
        const meeting = required(msnap, 'Встреча удалена.');
        if (meeting.joinCode !== code) fail('Код устарел.');
        if (meeting.status === 'deleting') fail('Встреча удаляется.');
        if (!existing.exists && meeting.status === 'finished') fail('Встреча завершена.');
        // Backfill receipts when returning to a round created before this schema
        // addition. New participants and new rounds need no collection query.
        if (existing.exists && !input.viewer && meeting.roundId && meeting.status !== 'finished') {
          const rref = mref.collection('rounds').doc(meeting.roundId);
          const receiptRef = rref.collection('private').doc(uid);
          const receipt = await tx.get(receiptRef);
          if (!receipt.exists) {
            const previous = await tx.getAll(
              ...[0, 1, 2].map((slot) =>
                rref.collection('responses').doc(responseId(meeting.roundId, uid, slot)),
              ),
            );
            const answers = Object.fromEntries(
              previous
                .filter((s) => s.exists)
                .map((s) => {
                  const response = s.data();
                  return [String(response.slot), ownResponse(response)];
                }),
            );
            if (Object.keys(answers).length) tx.set(receiptRef, { answers });
          }
        }
        if (!existing.exists) {
          if (!input.viewer && members.size >= 100)
            fail('Встреча рассчитана на 100 участников. Лимит достигнут.');
          tx.create(memberRef, { id: uid, joinedAt: now() });
          if (!input.viewer) tx.update(db.doc(`rooms/${sid}`), { joinedCount: members.size + 1 });
        }
        return { id: sid };
      });
    }
    const sid = text(input.sessionId, 100, 'ID встречи');
    if (!/^[a-zA-Z0-9-]+$/.test(sid)) fail('Некорректный ID встречи.');
    const mref = db.doc(`meetings/${sid}`),
      roomRef = db.doc(`rooms/${sid}`);
    if (action === 'delete') {
      await db.runTransaction(async (tx) => {
        const meeting = required(await tx.get(mref), 'Встреча не найдена.');
        owner(meeting, uid);
        tx.update(mref, { status: 'deleting' });
        tx.set(roomRef, { status: 'deleting', title: meeting.title, round: null, frozen: null });
        tx.delete(db.doc(`joinCodes/${meeting.joinCode}`));
      });
      await db.recursiveDelete(mref);
      await roomRef.delete();
      return { deleted: true };
    }
    if (action === 'export') {
      const meeting = required(await mref.get(), 'Встреча не найдена.');
      owner(meeting, uid);
      let roundDocs;
      if (input.roundId != null) {
        const rid = text(input.roundId, 100, 'ID вопроса');
        if (!/^[a-zA-Z0-9-]+$/.test(rid)) fail('Некорректный ID вопроса.');
        const selected = await mref.collection('rounds').doc(rid).get();
        const round = required(selected, 'Запуск вопроса не найден.');
        if (round.phase !== 'closed') fail('Завершите сбор ответов перед выгрузкой вопроса.');
        roundDocs = [selected];
      } else {
        if (meeting.status !== 'finished')
          fail('Завершите встречу перед выгрузкой, чтобы зафиксировать результаты.');
        roundDocs = (await mref.collection('rounds').get()).docs;
      }
      const exported = await Promise.all(
        roundDocs.map(async (snap) => {
          const responses = await snap.ref.collection('responses').get();
          return {
            ...snap.data(),
            answeredCount: new Set(responses.docs.map((d) => d.data().participantId)).size,
            responses: responses.docs.map((d) => {
              const { participantId: _privateId, requestId: _request, ...response } = d.data();
              return response;
            }),
          };
        }),
      );
      return {
        schemaVersion: 2,
        platform: 'Пульсар — платформа интерактивных опросов',
        title: meeting.title,
        exportedAt: now(),
        reportNotes: meeting.reportNotes ?? { conclusions: '', agreements: '', version: 0 },
        joinedCount: (await mref.collection('members').get()).size,
        rounds: exported,
      };
    }
    if (action === 'submit') {
      const rid = text(input.roundId, 100);
      if (!/^[a-zA-Z0-9-]+$/.test(rid)) fail('Некорректный ID раунда.');
      const slot = input.slot ?? 0;
      if (!Number.isInteger(slot) || slot < 0 || slot > 4) fail('Лимит карточек достигнут.');
      const rref = mref.collection('rounds').doc(rid);
      const id = responseId(rid, uid, slot);
      const ref = rref.collection('responses').doc(id);
      const requestId = text(input.requestId, 100);
      const started = performance.now();
      let readMs = 0,
        attempts = 0,
        ok = false;
      try {
        const result = await db.runTransaction(async (tx) => {
          // All paths are known before the read. One RPC instead of four serial
          // round trips; every gate stays in the transaction, so close/finish,
          // membership and revision checks retain their atomic guarantees.
          attempts++;
          const readStarted = performance.now();
          const [msnap, rsnap, member, previous, removed] = await tx.getAll(
            mref,
            rref,
            mref.collection('members').doc(uid),
            ref,
            rref.collection('removed').doc(id),
          );
          readMs += performance.now() - readStarted;
          const meeting = required(msnap, 'Встреча удалена или недоступна.');
          if (meeting.status === 'deleting') fail('Встреча удаляется.');
          const round = required(rsnap, 'Раунд не найден.');
          if (!member.exists) fail('Сначала подключитесь к встрече.');
          if (removed.exists) fail('Эта карточка удалена ведущим.');
          const max = round.slide.type === 'open-answers' ? round.settings.cardLimit : 1;
          if (slot >= max) fail('Лимит карточек достигнут.');
          const old = value(previous);
          if (old?.requestId === requestId) {
            if (old.value !== responseValue(round.slide, input.value))
              fail(
                'Эта попытка уже использована для другого ответа. Измените черновик и отправьте заново.',
              );
            return { id, revision: old.revision };
          }
          active(meeting);
          if (meeting.roundId !== rid || round.phase !== 'open') fail('Приём ответов закрыт.');
          if ((old?.revision ?? 0) !== input.revision)
            fail('Ответ уже изменён. Обновите его перед повторной отправкой.');
          const answer = responseValue(round.slide, input.value);
          const reasons = ['open-answers', 'word-cloud'].includes(round.slide.type)
            ? filterReasons(answer, meeting.contentPolicy, round.settings.contentFilter !== false)
            : [];
          const response = {
            id,
            roundId: rid,
            participantId: uid,
            type: round.slide.type,
            slot,
            value: answer,
            filterReasons: reasons,
            displayValue: null,
            history: old?.history ?? [],
            moderation:
              reasons.length ||
              (['open-answers', 'word-cloud'].includes(round.slide.type) &&
                round.settings.moderation)
                ? 'pending'
                : 'approved',
            createdAt: old?.createdAt ?? now(),
            updatedAt: now(),
            revision: (old?.revision ?? 0) + 1,
            requestId,
            likes: 0,
          };
          if (old)
            response.history = [
              ...response.history,
              { value: old.value, displayValue: old.displayValue, at: old.updatedAt },
            ].slice(-20);
          tx.set(ref, response);
          tx.set(
            rref.collection('private').doc(uid),
            {
              answers: { [slot]: ownResponse(response) },
            },
            { merge: true },
          );
          const pref = rref.collection('published').doc(id);
          if (round.visible && response.moderation === 'approved')
            tx.set(pref, publicResponse(response));
          // A new hidden/pending answer has never been published. Avoid a no-op
          // delete; an edit still removes any previously published version.
          else if (old) tx.delete(pref);
          return { id, revision: response.revision };
        });
        ok = true;
        return result;
      } finally {
        onSubmitTiming({
          durationMs: Math.round(performance.now() - started),
          readMs: Math.round(readMs),
          attempts,
          ok,
        });
      }
    }
    return db.runTransaction(async (tx) => {
      const meeting = required(await tx.get(mref), 'Встреча удалена или недоступна.');
      if (action === 'reportNotes') {
        owner(meeting, uid);
        if (meeting.status === 'deleting') fail('Встреча удаляется.');
        if (input.version !== (meeting.reportNotes?.version ?? 0))
          fail('Выводы изменены в другой вкладке. Обновите страницу перед сохранением.');
        const note = (value) => {
          if (typeof value !== 'string' || [...value.trim()].length > 4000)
            fail('Выводы и договорённости: не больше 4000 символов в каждом поле.');
          return value.trim();
        };
        const reportNotes = {
          conclusions: note(input.conclusions),
          agreements: note(input.agreements),
          version: input.version + 1,
          updatedAt: now(),
        };
        tx.update(mref, { reportNotes });
        return { reportNotes };
      }
      active(meeting);
      if (action === 'contentPolicy') {
        owner(meeting, uid);
        const policy = contentPolicy(input.policy);
        tx.update(mref, { contentPolicy: policy });
        return { policy };
      }
      if (action === 'save') {
        owner(meeting, uid);
        if (input.version !== meeting.version)
          fail('Встреча изменена в другой вкладке. Обновите редактор перед сохранением.');
        if (!Array.isArray(input.slides) || !input.slides.length || input.slides.length > 50)
          fail('Нужно от 1 до 50 слайдов.');
        const slides = input.slides.map(validSlide);
        if (new Set(slides.map((s) => s.id)).size !== slides.length) fail('Повторяющиеся слайды.');
        const title = text(input.title, 150, 'Название');
        tx.update(mref, {
          title,
          slides,
          currentSlideId: input.currentSlideId,
          version: meeting.version + 1,
        });
        tx.update(roomRef, { title });
        return { version: meeting.version + 1 };
      }
      if (action === 'open' || action === 'navigate') {
        owner(meeting, uid);
        const rid = text(input.requestId, 100);
        if (!/^[a-zA-Z0-9-]+$/.test(rid)) fail('Некорректный ID раунда.');
        const newRef = mref.collection('rounds').doc(rid);
        const existing = await tx.get(newRef);
        if (existing.exists) return { id: rid };
        const previousRef = meeting.roundId ? mref.collection('rounds').doc(meeting.roundId) : null;
        const previous = previousRef ? await tx.get(previousRef) : null;
        const slide = meeting.slides.find((s) => s.id === input.slideId);
        if (!slide) fail('Сначала сохраните слайд.');
        if (action === 'navigate') {
          const saved = await tx.get(mref.collection('rounds').where('slide.id', '==', slide.id));
          const latest = saved.docs
            .map((snap) => snap.data())
            .sort(
              (a, b) =>
                (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id),
            )[0];
          if (latest) {
            if (meeting.roundId === latest.id) return { id: latest.id, restored: true };
            if (previous?.exists) tx.update(previousRef, { phase: 'closed', likesOpen: false });
            latest.phase = 'closed';
            latest.likesOpen = false;
            tx.update(mref.collection('rounds').doc(latest.id), {
              phase: 'closed',
              likesOpen: false,
            });
            tx.update(mref, { status: 'live', liveSlideId: slide.id, roundId: latest.id });
            tx.update(roomRef, { status: 'live', round: publicRound(latest), frozen: null });
            return { id: latest.id, restored: true };
          }
        }
        const problem = launchProblem(slide);
        if (problem) fail(problem);
        const config = launchSettings(slide, slide.launch ?? input.settings);
        const round = {
          id: rid,
          slide,
          settings: config,
          phase: 'open',
          visible: config.immediate,
          likesOpen: slide.type === 'open-answers' && config.immediate,
          createdAt: now(),
          deadline: null,
        };
        if (previous?.exists) tx.update(previousRef, { phase: 'closed', likesOpen: false });
        tx.create(newRef, round);
        tx.update(mref, { status: 'live', liveSlideId: slide.id, roundId: rid });
        tx.update(roomRef, { status: 'live', round: publicRound(round), frozen: null });
        return { id: rid };
      }
      if (action === 'finish') {
        owner(meeting, uid);
        const rref = meeting.roundId ? mref.collection('rounds').doc(meeting.roundId) : null;
        const rsnap = rref ? await tx.get(rref) : null;
        const round = rsnap?.data();
        if (round) {
          round.phase = 'closed';
          round.likesOpen = false;
          tx.update(rref, { phase: 'closed', likesOpen: false });
        }
        tx.update(mref, { status: 'finished' });
        tx.update(roomRef, { status: 'finished', round: publicRound(round), frozen: null });
        return { finished: true };
      }
      const rid = meeting.roundId;
      if (!rid || (input.roundId && input.roundId !== rid)) fail('Этот вопрос уже не в эфире.');
      const rref = mref.collection('rounds').doc(rid);
      const round = required(await tx.get(rref), 'Раунд не найден.');
      if (action === 'like') {
        if (!round.visible || !round.likesOpen) fail('Этап лайков закрыт.');
        const id = text(input.responseId, 100);
        if (!/^[a-f0-9]{64}$/.test(id)) fail('Карточка не найдена.');
        const ref = rref.collection('responses').doc(id),
          lref = rref.collection('likes').doc(`${id}_${uid}`);
        const [ms, rs, ls] = await tx.getAll(mref.collection('members').doc(uid), ref, lref);
        if (!ms.exists) fail('Нет доступа участника.');
        const response = required(rs, 'Карточка не найдена.');
        if (response.participantId === uid) fail('Нельзя поставить лайк своему ответу.');
        if (response.moderation !== 'approved' || response.type !== 'open-answers')
          fail('Карточка скрыта.');
        const old = value(ls),
          enabled = input.enabled === true;
        const previous = old?.revision === response.revision && old.enabled;
        if (Boolean(previous) === enabled) return { enabled };
        response.likes = Math.max(0, response.likes + (enabled ? 1 : -1));
        tx.set(lref, { uid, responseId: id, enabled, revision: response.revision });
        tx.update(ref, { likes: response.likes });
        tx.set(rref.collection('published').doc(id), publicResponse(response));
        return { enabled };
      }
      owner(meeting, uid);
      if (action === 'deleteResponse') {
        const id = text(input.responseId, 100);
        if (!/^[a-f0-9]{64}$/.test(id)) fail('Карточка не найдена.');
        const ref = rref.collection('responses').doc(id);
        const [responseSnap, removedSnap] = await tx.getAll(
          ref,
          rref.collection('removed').doc(id),
        );
        if (removedSnap.exists) return { deleted: true };
        const response = required(responseSnap, 'Карточка не найдена.');
        if (!['open-answers', 'word-cloud'].includes(response.type))
          fail('Можно удалить только текстовую карточку.');
        if (input.revision !== response.revision) fail('Карточка изменилась. Проверьте её заново.');
        const privateRef = rref.collection('private').doc(response.participantId);
        const privateSnap = await tx.get(privateRef);
        const likes = await tx.get(rref.collection('likes').where('responseId', '==', id));
        const answers = { ...(privateSnap.data()?.answers ?? {}) };
        delete answers[response.slot];
        tx.set(privateRef, { answers });
        tx.set(rref.collection('removed').doc(id), { slot: response.slot, deletedAt: now() });
        tx.delete(ref);
        tx.delete(rref.collection('published').doc(id));
        for (const like of likes.docs) tx.delete(like.ref);
        tx.update(roomRef, { frozen: null });
        return { deleted: true };
      }
      if (action === 'moderationSettings') {
        if (!['open-answers', 'word-cloud'].includes(round.slide.type))
          fail('Модерация доступна для текстовых вопросов.');
        if (
          typeof input.moderation !== 'boolean' ||
          (input.contentFilter !== undefined && typeof input.contentFilter !== 'boolean')
        )
          fail('Некорректные настройки модерации.');
        const all = await tx.get(rref.collection('responses'));
        round.settings = {
          ...round.settings,
          moderation: input.moderation,
          contentFilter: input.contentFilter ?? round.settings.contentFilter ?? true,
        };
        if (!input.moderation) {
          round.settings.immediate = true;
          round.visible = true;
          if (round.slide.type === 'open-answers') round.likesOpen = true;
        }
        for (const snap of all.docs) {
          const response = snap.data();
          // Hidden answers and filter holds need an explicit host decision.
          if (
            !input.moderation &&
            response.moderation === 'pending' &&
            !response.filterReasons?.length
          ) {
            response.moderation = 'approved';
            tx.set(snap.ref, response);
            tx.set(
              rref.collection('private').doc(response.participantId),
              { answers: { [response.slot]: ownResponse(response) } },
              { merge: true },
            );
          }
          if (round.visible && response.moderation === 'approved')
            tx.set(rref.collection('published').doc(response.id), publicResponse(response));
        }
        tx.set(rref, round);
        tx.update(roomRef, { round: publicRound(round), frozen: null });
        return { ok: true };
      }
      if (action === 'moderate') {
        if (
          !Array.isArray(input.ids) ||
          input.ids.length < 1 ||
          input.ids.length > 100 ||
          !input.ids.every((id) => /^[a-f0-9]{64}$/.test(id))
        )
          fail('Выберите от 1 до 100 карточек.');
        if (!['approved', 'hidden'].includes(input.status)) fail('Неизвестное действие модерации.');
        const docs = await tx.getAll(
          ...[...new Set(input.ids)].map((id) => rref.collection('responses').doc(id)),
        );
        for (const snap of docs) {
          const response = required(snap, 'Ответ не найден.');
          if (!['open-answers', 'word-cloud'].includes(response.type))
            fail('Этот ответ не требует модерации.');
          if (input.revisions?.[response.id] !== response.revision)
            fail('Ответ изменился. Проверьте обновлённый текст перед одобрением.');
          response.moderation = input.status;
          if (input.displayValue != null) {
            if (docs.length !== 1 || input.revision !== response.revision)
              fail('Ответ изменился; откройте редактор заново.');
            response.history = [
              ...response.history,
              {
                value: response.value,
                displayValue: response.displayValue,
                at: now(),
                editor: 'host',
              },
            ].slice(-20);
            response.displayValue = responseValue(round.slide, input.displayValue);
          }
          tx.set(snap.ref, response);
          tx.set(
            rref.collection('private').doc(response.participantId),
            {
              answers: { [response.slot]: ownResponse(response) },
            },
            { merge: true },
          );
          if (round.visible && response.moderation === 'approved')
            tx.set(rref.collection('published').doc(response.id), publicResponse(response));
          else tx.delete(rref.collection('published').doc(response.id));
        }
        // Clear snapshots left by older versions.
        if (input.status === 'hidden') tx.update(roomRef, { frozen: null });
        return { count: docs.length };
      }
      // Compatibility for older clients: freezing is retired, so only clear old snapshots.
      if (action === 'freeze') {
        tx.update(roomRef, { frozen: null });
        return { frozen: false };
      }
      if (action === 'close') round.phase = 'closed';
      else if (action === 'reveal') {
        const all = await tx.get(rref.collection('responses'));
        for (const snap of all.docs) {
          const response = snap.data();
          if (response.moderation === 'approved')
            tx.set(rref.collection('published').doc(response.id), publicResponse(response));
        }
        round.visible = true;
        if (round.slide.type === 'open-answers') round.likesOpen = true;
      } else if (action === 'likes') {
        if (!round.visible || round.slide.type !== 'open-answers')
          fail('Сначала покажите результаты открытого вопроса.');
        round.likesOpen = Boolean(input.enabled);
      } else if (action === 'timer') {
        if (
          round.phase !== 'open' ||
          !Number.isInteger(input.seconds) ||
          input.seconds < 0 ||
          input.seconds > 3600
        )
          fail('Таймер: от 0 до 3600 секунд для открытого вопроса.');
        round.deadline = input.seconds
          ? new Date(Date.now() + input.seconds * 1000).toISOString()
          : null;
      } else if (action === 'appearance') {
        const source = meeting.slides.find((s) => s.id === round.slide.id);
        if (!source) fail('Слайд удалён из редактора.');
        for (const key of ['visualization', 'resultDisplay', 'projectorView', 'metricDisplay'])
          if (source[key] != null) round.slide[key] = source[key];
      } else fail('Неизвестное действие.');
      tx.set(rref, round);
      tx.update(roomRef, { round: publicRound(round), frozen: null });
      return { ok: true };
    });
  };
}
