import { collection, doc, limit, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { Session } from '../types/common';

type FirestoreSession = Session & {
  ownerUid: string;
  updatedAt: string;
};

function getSessionRef(sessionId: string) {
  return doc(db, 'sessions', sessionId);
}

function getSessionsCollection() {
  return collection(db, 'sessions');
}

export async function ensureSessionDocument(session: Session, ownerUid: string) {
  const sessionRef = getSessionRef(session.id);
  const payload: FirestoreSession = {
    ...session,
    ownerUid,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(sessionRef, payload, { merge: true });
}

export function subscribeToSession(
  sessionId: string,
  onData: (session: Session) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    getSessionRef(sessionId),
    (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }

      const data = snapshot.data() as FirestoreSession;
      const { ownerUid: _ownerUid, updatedAt: _updatedAt, ...session } = data;
      onData(session);
    },
    (error) => {
      onError(error);
    },
  );
}

export function subscribeToSessionByJoinCode(
  joinCode: string,
  onData: (session: Session) => void,
  onMissing: () => void,
  onError: (error: Error) => void,
) {
  const normalizedCode = joinCode.trim().toUpperCase();

  return onSnapshot(
    query(getSessionsCollection(), where('joinCode', '==', normalizedCode), limit(1)),
    (snapshot) => {
      if (snapshot.empty) {
        onMissing();
        return;
      }

      const data = snapshot.docs[0].data() as FirestoreSession;
      const { ownerUid: _ownerUid, updatedAt: _updatedAt, ...session } = data;
      onData(session);
    },
    (error) => {
      onError(error);
    },
  );
}

export async function saveSessionDocument(session: Session, ownerUid: string) {
  const payload: FirestoreSession = {
    ...session,
    ownerUid,
    updatedAt: new Date().toISOString(),
  };

  await setDoc(getSessionRef(session.id), payload, { merge: true });
}

export async function updateSessionDocument(
  sessionId: string,
  patch: Partial<Session>,
  ownerUid: string,
) {
  await updateDoc(getSessionRef(sessionId), {
    ...patch,
    ownerUid,
    updatedAt: new Date().toISOString(),
  });
}
