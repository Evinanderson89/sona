import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  JournalEntry,
  UserProfile,
  Breakthrough,
  DailyMission,
  ConversationSession,
} from "@sona/shared";

const JOURNAL_KEY = "sona.journal.v1";
const IMPROV_RECENT_KEY = "sona.improv.recent.v1";
const PROFILE_KEY = "sona.profile.v1";
const BREAKTHROUGHS_KEY = "sona.breakthroughs.v1";
const MISSION_KEY = "sona.mission.v1";
const CONVERSATION_KEY = "sona.conversations.v1";

export async function listJournal(): Promise<JournalEntry[]> {
  const raw = await AsyncStorage.getItem(JOURNAL_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as JournalEntry[];
    return parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

export async function appendJournal(entry: JournalEntry): Promise<void> {
  const existing = await listJournal();
  existing.unshift(entry);
  await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(existing.slice(0, 200)));
}

export async function clearJournal(): Promise<void> {
  await AsyncStorage.removeItem(JOURNAL_KEY);
}

export async function recentImprov(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(IMPROV_RECENT_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function pushImprov(constraint: string): Promise<void> {
  const list = await recentImprov();
  list.unshift(constraint);
  await AsyncStorage.setItem(
    IMPROV_RECENT_KEY,
    JSON.stringify(list.slice(0, 10)),
  );
}

export async function getProfile(): Promise<UserProfile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function bumpTakesSinceCalibration(): Promise<UserProfile | null> {
  const profile = await getProfile();
  if (!profile) return null;
  const next = { ...profile, takesSinceCalibration: profile.takesSinceCalibration + 1 };
  await saveProfile(next);
  return next;
}

export async function listBreakthroughs(): Promise<Breakthrough[]> {
  const raw = await AsyncStorage.getItem(BREAKTHROUGHS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Breakthrough[];
  } catch {
    return [];
  }
}

export async function pushBreakthroughs(items: Breakthrough[]): Promise<void> {
  if (items.length === 0) return;
  const existing = await listBreakthroughs();
  const merged = [...items, ...existing].slice(0, 30);
  await AsyncStorage.setItem(BREAKTHROUGHS_KEY, JSON.stringify(merged));
}

export async function getMission(): Promise<DailyMission | null> {
  const raw = await AsyncStorage.getItem(MISSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DailyMission;
  } catch {
    return null;
  }
}

export async function saveMission(m: DailyMission): Promise<void> {
  await AsyncStorage.setItem(MISSION_KEY, JSON.stringify(m));
}

export async function listConversations(): Promise<ConversationSession[]> {
  const raw = await AsyncStorage.getItem(CONVERSATION_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ConversationSession[];
    return parsed.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

export async function saveConversation(s: ConversationSession): Promise<void> {
  const list = await listConversations();
  // Replace existing by id, or insert
  const filtered = list.filter((c) => c.id !== s.id);
  filtered.unshift(s);
  await AsyncStorage.setItem(
    CONVERSATION_KEY,
    JSON.stringify(filtered.slice(0, 100)),
  );
}
