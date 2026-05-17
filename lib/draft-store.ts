'use client';

import type { Extraction } from '@/lib/types';

const KEY = 'aical:draft';

export type Draft = {
  extraction: Extraction;
  source_text: string;
  source_type: 'text' | 'voice';
  warning?: string;
};

export function saveDraft(d: Draft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}

export function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
