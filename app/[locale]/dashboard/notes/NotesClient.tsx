'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';

import {
  apiAdminListNotes,
  apiAdminReplyToNote,
  apiListMyNotes,
  apiRaiseNote,
  type AdminNote,
  type CustomerNote,
  type NoteKind,
} from '@/lib/api/orders';

const KINDS: NoteKind[] = ['NUDGE', 'COMPLAINT', 'NOTE'];

/**
 * One screen, two jobs, chosen by role.
 *
 * A customer raises notes and reads replies; an admin works the queue. They are
 * the same subject matter and the same route in the table, so splitting them
 * into two pages would duplicate the list rendering to no benefit — but the
 * WRITE paths are entirely separate and gated server-side, which is the part
 * that matters.
 */
export function NotesClient({ isAdmin }: { isAdmin: boolean }) {
  return isAdmin ? <AdminQueue /> : <MyNotes />;
}

function MyNotes() {
  const t = useTranslations('notesPage');
  const tk = useTranslations('notes');

  const [notes, setNotes] = useState<CustomerNote[] | null>(null);
  const [kind, setKind] = useState<NoteKind>('NOTE');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => apiListMyNotes().then(setNotes).catch(() => setError('!'));
  useEffect(() => {
    void load();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiRaiseNote({ kind, body });
      setBody('');
      await load();
    } catch {
      setError('!');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label style={{ fontSize: 'var(--bobr-text-sm)', fontWeight: 500 }}>
          {t('kind')}
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as NoteKind)}
            style={selectStyle}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {tk(k.toLowerCase() as 'nudge' | 'complaint' | 'note')}
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 'var(--bobr-text-sm)', fontWeight: 500 }}>
          {t('body')}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={2000}
            style={{ ...selectStyle, resize: 'vertical' }}
          />
        </label>

        <div>
          <button type="submit" disabled={busy || !body.trim()} style={buttonStyle}>
            {busy ? t('sending') : t('submit')}
          </button>
        </div>
        {error && <p style={{ color: 'var(--bobr-danger)' }}>{error}</p>}
      </form>

      <section>
        <h2 style={{ fontSize: 'var(--bobr-text-h4)', marginBottom: '0.75rem' }}>
          {t('mine')}
        </h2>
        {!notes ? (
          <p>…</p>
        ) : notes.length === 0 ? (
          <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('none')}</p>
        ) : (
          <ul style={listStyle}>
            {notes.map((n) => (
              <li key={n.id} style={cardStyle}>
                <strong style={{ fontSize: 'var(--bobr-text-sm)' }}>
                  {tk(n.kind.toLowerCase() as 'nudge' | 'complaint' | 'note')}
                </strong>
                <p>{n.body}</p>
                {n.adminReply ? (
                  // The reply is visually attached to the note rather than
                  // listed separately: an answer that looks like a new message
                  // reads as unrelated.
                  <blockquote
                    style={{
                      margin: '0.5rem 0 0',
                      paddingLeft: '0.75rem',
                      borderLeft: '3px solid var(--bobr-accent)',
                    }}
                  >
                    <span style={mutedLabel}>{t('reply')}</span>
                    <p>{n.adminReply}</p>
                  </blockquote>
                ) : (
                  <span style={mutedLabel}>{t('awaiting')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AdminQueue() {
  const t = useTranslations('notesPage');
  const tk = useTranslations('notes');

  const [notes, setNotes] = useState<AdminNote[] | null>(null);
  const [unansweredOnly, setUnansweredOnly] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = (only: boolean) =>
    apiAdminListNotes(only).then(setNotes).catch(() => setNotes([]));

  useEffect(() => {
    void load(unansweredOnly);
  }, [unansweredOnly]);

  async function send(id: string) {
    const text = (drafts[id] ?? '').trim();
    if (!text) return;
    setBusy(id);
    try {
      await apiAdminReplyToNote(id, text);
      setDrafts((d) => ({ ...d, [id]: '' }));
      await load(unansweredOnly);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={unansweredOnly}
          onChange={(e) => setUnansweredOnly(e.target.checked)}
        />
        {t('unansweredOnly')}
      </label>

      {!notes ? (
        <p>…</p>
      ) : notes.length === 0 ? (
        <p style={{ color: 'var(--bobr-fg-muted)' }}>{t('none')}</p>
      ) : (
        <ul style={listStyle}>
          {notes.map((n) => (
            <li key={n.id} style={cardStyle}>
              <strong style={{ fontSize: 'var(--bobr-text-sm)' }}>
                {tk(n.kind.toLowerCase() as 'nudge' | 'complaint' | 'note')}{' '}
                <span style={{ fontWeight: 400, color: 'var(--bobr-fg-muted)' }}>
                  {t('from')} {n.user?.email ?? '—'}
                </span>
              </strong>
              <p>{n.body}</p>

              {n.adminReply ? (
                <blockquote
                  style={{
                    margin: '0.5rem 0 0',
                    paddingLeft: '0.75rem',
                    borderLeft: '3px solid var(--bobr-accent)',
                  }}
                >
                  <span style={mutedLabel}>{t('answered')}</span>
                  <p>{n.adminReply}</p>
                </blockquote>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <textarea
                    value={drafts[n.id] ?? ''}
                    onChange={(e) =>
                      setDrafts((d) => ({ ...d, [n.id]: e.target.value }))
                    }
                    placeholder={t('replyPlaceholder')}
                    rows={2}
                    maxLength={2000}
                    style={{ ...selectStyle, flex: 1, resize: 'vertical' }}
                  />
                  <button
                    type="button"
                    onClick={() => send(n.id)}
                    disabled={busy === n.id || !(drafts[n.id] ?? '').trim()}
                    style={buttonStyle}
                  >
                    {t('sendReply')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--bobr-surface)',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius)',
  padding: '1rem',
};

const selectStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '0.3rem',
  padding: '0.6rem 0.7rem',
  font: 'inherit',
  color: 'var(--bobr-fg)',
  background: 'var(--bobr-surface)',
  border: '1px solid var(--bobr-border)',
  borderRadius: 'var(--bobr-radius-control)',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.6rem 1.1rem',
  font: 'inherit',
  fontWeight: 600,
  color: 'var(--bobr-on-dark)',
  background: 'var(--bobr-fg)',
  border: 0,
  borderRadius: 'var(--bobr-radius-control)',
  cursor: 'pointer',
};

const mutedLabel: React.CSSProperties = {
  fontSize: 'var(--bobr-text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--bobr-fg-muted)',
};
