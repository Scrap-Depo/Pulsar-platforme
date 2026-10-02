import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { message } from '../lib/liveApi';
export function useLiveDoc<T>(path: string | null) {
  const [state, setState] = useState<{
    path: string | null;
    data: T | null;
    error: string;
    loaded: boolean;
  }>({ path, data: null, error: '', loaded: false });
  useEffect(() => {
    if (!path) return;
    setState({ path, data: null, error: '', loaded: false });
    return onSnapshot(
      doc(db, path),
      (snap) =>
        setState({
          path,
          data: snap.exists() ? (snap.data() as T) : null,
          error: '',
          loaded: true,
        }),
      (error) => setState({ path, data: null, error: message(error), loaded: true }),
    );
  }, [path]);
  return state.path === path ? state : { data: null, error: '', loaded: false };
}
export function useLiveList<T>(path: string | null, field?: string, equal?: string) {
  const key = `${path}:${field}:${equal}`;
  const [state, setState] = useState<{ key: string; data: T[]; error: string; loaded: boolean }>({
    key,
    data: [],
    error: '',
    loaded: false,
  });
  useEffect(() => {
    if (!path) return;
    setState({ key, data: [], error: '', loaded: false });
    const ref = collection(db, path);
    return onSnapshot(
      field ? query(ref, where(field, '==', equal)) : ref,
      (snap) =>
        setState({ key, data: snap.docs.map((d) => d.data() as T), error: '', loaded: true }),
      (error) => setState({ key, data: [], error: message(error), loaded: true }),
    );
  }, [path, field, equal, key]);
  return state.key === key ? state : { data: [], error: '', loaded: false };
}
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
