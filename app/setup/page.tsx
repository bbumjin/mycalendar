import Link from 'next/link';
import fs from 'node:fs/promises';
import path from 'node:path';
import { CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Health = { ok: boolean; missing: string[]; results: Record<string, { ok: boolean; error?: string }> };

const REQUIRED = ['profiles', 'calendar_accounts', 'events', 'reminders', 'voice_transcripts', 'briefings', 'events_with_reminders'];

async function getHealth(): Promise<Health> {
  const admin = getSupabaseAdminClient();
  const results: Record<string, { ok: boolean; error?: string }> = {};
  await Promise.all(
    REQUIRED.map(async (t) => {
      const { error } = await admin.from(t).select('*').limit(1);
      results[t] = error ? { ok: false, error: error.message } : { ok: true };
    })
  );
  const missing = REQUIRED.filter((t) => !results[t].ok);
  return { ok: missing.length === 0, missing, results };
}

async function getMigrationSQL(): Promise<string> {
  const p = path.join(process.cwd(), 'supabase', 'migrations', '0001_init.sql');
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return '/* supabase/migrations/0001_init.sql 파일을 읽을 수 없습니다 */';
  }
}

export default async function SetupPage() {
  const health = await getHealth();
  const sql = await getMigrationSQL();
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0];
  const sqlEditorUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}/sql/new` : 'https://supabase.com/dashboard';

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">초기 설정</h1>
      <p className="text-[var(--muted)] mt-1">Supabase 스키마 상태를 확인합니다.</p>

      <div className={`mt-6 rounded-2xl p-4 ${health.ok ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50'}`}>
        <h2 className="font-medium">
          {health.ok ? '모든 테이블이 정상입니다.' : `${health.missing.length}개의 테이블이 누락되었습니다.`}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {Object.entries(health.results).map(([t, r]) => (
            <li key={t} className="flex items-center gap-2">
              {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
              <span className="font-mono text-xs">{t}</span>
              {!r.ok && r.error && <span className="text-[10px] text-[var(--muted)] truncate">— {r.error}</span>}
            </li>
          ))}
        </ul>
      </div>

      {!health.ok && (
        <section className="mt-6 card p-5">
          <h3 className="font-medium">마이그레이션 적용</h3>
          <p className="text-sm text-[var(--muted)] mt-1">
            Supabase 클라우드는 REST로 DDL 실행을 허용하지 않으므로, 아래 SQL을 한 번만 프로젝트의 SQL 편집기에 붙여넣어 실행해주세요.
          </p>
          <a href={sqlEditorUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 btn-primary text-sm">
            <ExternalLink className="w-4 h-4" /> SQL 편집기 열기
          </a>
          <pre className="mt-4 max-h-80 overflow-auto text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded-xl p-3 font-mono whitespace-pre">{sql}</pre>
        </section>
      )}

      <p className="mt-6 text-sm text-[var(--muted)]">
        <Link href="/" className="underline">홈으로 돌아가기</Link>
      </p>
    </main>
  );
}
