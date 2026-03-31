import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { SessionResponse } from '../types/common';

function getResponsesCollection(sessionId: string) {
  return collection(db, 'sessions', sessionId, 'responses');
}

function getResponseRef(sessionId: string, responseId: string) {
  return doc(db, 'sessions', sessionId, 'responses', responseId);
}

export function subscribeToResponses(
  sessionId: string,
  onData: (responses: SessionResponse[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    getResponsesCollection(sessionId),
    (snapshot) => {
      const responses = snapshot.docs
        .map((item) => item.data() as SessionResponse)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

      onData(responses);
    },
    (error) => {
      onError(error);
    },
  );
}

export async function saveResponse(sessionId: string, response: SessionResponse) {
  await setDoc(getResponseRef(sessionId, response.id), response);
}
