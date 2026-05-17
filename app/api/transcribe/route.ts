import { NextResponse, type NextRequest } from 'next/server';
import OpenAI from 'openai';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const audio = form.get('audio');
  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'audio file required' }, { status: 400 });
  }

  try {
    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: 'whisper-1',
    });
    const transcript = transcription.text?.trim() ?? '';

    // Persist for debugging/learning, then drop the raw audio bytes implicitly.
    await supabase
      .from('voice_transcripts')
      .insert({
        user_id: user.id,
        transcript,
        duration_seconds: null,
      });

    return NextResponse.json({ transcript });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'transcription failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
