import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Participant } from '../types/common';
import { db } from './firebase';

type FirestoreParticipant = Participant & {
  joinedAt: string;
};

function getParticipantsCollection(sessionId: string) {
  return collection(db, 'sessions', sessionId, 'participants');
}

function getParticipantRef(sessionId: string, participantId: string) {
  return doc(db, 'sessions', sessionId, 'participants', participantId);
}

export function subscribeToParticipants(
  sessionId: string,
  onData: (participants: Participant[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    getParticipantsCollection(sessionId),
    (snapshot) => {
      const participants = snapshot.docs
        .map((item) => item.data() as FirestoreParticipant)
        .sort((left, right) => left.joinedAt.localeCompare(right.joinedAt))
        .map(({ joinedAt: _joinedAt, ...participant }) => participant);

      onData(participants);
    },
    (error) => {
      onError(error);
    },
  );
}

export async function saveParticipant(sessionId: string, participant: Participant) {
  const payload: FirestoreParticipant = {
    ...participant,
    joinedAt: new Date().toISOString(),
  };

  await setDoc(getParticipantRef(sessionId, participant.id), payload);
}
