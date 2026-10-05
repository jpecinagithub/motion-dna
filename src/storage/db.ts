/**
 * IndexedDB persistence for motion sessions (Dexie).
 */
import Dexie, { type Table } from 'dexie';
import { LIBRARY_MAX_SESSIONS } from '../config';
import type { MotionSession } from '../types';
import { uid } from '../lib/utils';

class MotionDnaDb extends Dexie {
  sessions!: Table<MotionSession, string>;

  constructor() {
    super('motion-dna');
    this.version(1).stores({ sessions: 'id, createdAt' });
  }
}

export const db = new MotionDnaDb();

/** Insert/update a session, then enforce the library size cap (delete oldest first). */
export async function saveSession(s: MotionSession): Promise<void> {
  await db.sessions.put(s);
  const count = await db.sessions.count();
  const overflow = count - LIBRARY_MAX_SESSIONS;
  if (overflow > 0) {
    await db.sessions.orderBy('createdAt').limit(overflow).delete();
  }
}

/** Newest first. */
export async function listSessions(): Promise<MotionSession[]> {
  return db.sessions.orderBy('createdAt').reverse().toArray();
}

export async function getSession(id: string): Promise<MotionSession | undefined> {
  return db.sessions.get(id);
}

export async function renameSession(id: string, name: string): Promise<void> {
  await db.sessions.update(id, { name });
}

export async function duplicateSession(id: string): Promise<MotionSession> {
  const original = await getSession(id);
  if (!original) throw new Error(`session-not-found:${id}`);
  const clone: MotionSession = {
    ...original,
    id: uid('sess'),
    name: `${original.name} (copy)`,
    createdAt: new Date().toISOString(),
  };
  await saveSession(clone);
  return clone;
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id);
}

export async function clearAllSessions(): Promise<void> {
  await db.sessions.clear();
}
