import { fetchBriefings } from './dbService';
import { Linking } from 'react-native';

export interface MetaphorDocument {
  id: string;
  title: string;
  summary: string;
  url?: string;
  tags: string[];
}

const METAPHOR_API = 'http://localhost:8000/api/v1/pipeline';

export async function fetchMetaphorContext(query: string): Promise<MetaphorDocument[]> {
  try {
    const data = await fetchBriefings();

    if (data) {
      const mapped = data.map((d: any) => ({
        id: d.id,
        title: d.title,
        summary: d.body || d.subtitle,
        tags: [d.type || 'Context'],
      }));
      if (!query.trim()) return mapped;
      return mapped.filter((m: any) => m.title.toLowerCase().includes(query.toLowerCase()) || m.summary.toLowerCase().includes(query.toLowerCase()));
    }
  } catch (err) {
    console.log('Metaphor Adapter fetch error:', err);
  }
  return [];
}

/**
 * Pushes a transcribed voice thought or decision directly into Metaphor OS graph intake
 */
export async function pushVoiceThoughtToMetaphor(thought: { title: string; text: string }): Promise<boolean> {
  try {
    const res = await fetch(`${METAPHOR_API}/intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'orion-mobile',
        type: 'voice-thought',
        title: thought.title,
        content: thought.text,
      }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Metaphor intake error:', err);
    return false;
  }
}

/**
 * 1-Tap launches Clario Studio with the voice note transcribed script
 */
export function launchClarioFromThought(thoughtText: string, title = 'Orion Voice Note') {
  const url = `https://clariovid.vercel.app/?script=${encodeURIComponent(thoughtText)}&mode=video&name=${encodeURIComponent(title)}`;
  Linking.openURL(url).catch(err => console.warn('Failed to open Clario:', err));
}
