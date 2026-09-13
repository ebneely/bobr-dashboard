/**
 * The one way this app talks to bobr_backend.
 *
 * Deliberately a hand-written fetch wrapper rather than axios: the only things
 * we need on top of fetch are a base URL, credentialed cookies and a single
 * error shape, and all three are a few lines each.
 */

const BASE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8003'}/v1`;

/** One item of a 422 validation failure. `code`/`params` are what a client translates. */
export interface FieldIssue {
  field: string;
  issue: string;
  code?: string;
  params?: Record<string, string | number>;
}

/** The error body every backend failure arrives in — see the backend's HttpExceptionFilter. */
export interface ApiErrorBody {
  statusCode: number;
  /** English, for logs and older clients. Show a translated `code` in preference. */
  message: string | string[] | FieldIssue[];
  error: string;
  /** Stable, machine-readable reason — `apiErrors.codes.<code>` in messages. */
  code?: string;
  params?: Record<string, string | number>;
  traceId?: string;
  path?: string;
  timestamp?: string;
}

/**
 * Turns an error code (or `field:<path>` for a field label) into a localised
 * string, or null when this client has no wording for it.
 */
export type ApiErrorTranslate = (
  code: string,
  params?: Record<string, string | number>,
) => string | null;

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;
  /** Quote this in a bug report — it finds the exact server log line. */
  readonly traceId?: string;

  constructor(status: number, body: ApiErrorBody | null) {
    super(formatApiError(body) || `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.traceId = body?.traceId;
  }
}

/**
 * The backend's `message` is a string, a string[], or a `{field, issue}[]` for
 * validation failures. Callers that just want something to show a user should
 * use this rather than each re-deriving the three cases.
 *
 * With `translate`, a known `code` wins over the English `message`; an unknown
 * code falls back to that English text — never a blank and never a raw key.
 */
export function formatApiError(
  body: ApiErrorBody | null | undefined,
  translate?: ApiErrorTranslate,
): string {
  if (!body) return '';
  const { message } = body;

  const isFieldIssues =
    Array.isArray(message) && message.some((m) => typeof m !== 'string');

  if (!isFieldIssues && translate && body.code) {
    const translated = translate(body.code, body.params);
    if (translated) return translated;
  }

  if (typeof message === 'string') return message;
  if (!Array.isArray(message)) return '';

  return message
    .map((m) => {
      if (typeof m === 'string') return m;
      const text = translate && m.code ? translate(m.code, m.params) : null;
      if (!text) return `${m.field}: ${m.issue}`;
      const label = translate ? translate(`field:${m.field}`) : null;
      return label ? `${label}: ${text}` : text;
    })
    .join('\n');
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Send the session cookie. Defaults to true. */
  auth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  { body, auth = true, headers, ...init }: ApiFetchOptions = {},
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    // Auth is an httpOnly cookie, so it rides along on its own — there is no
    // token in JS to attach, which is the point.
    credentials: auth ? 'include' : 'omit',
    headers: {
      // Never set Content-Type on FormData: the browser has to add its own
      // multipart boundary, and overriding it makes the request unparseable
      // on the server with no useful error.
      ...(isFormData || body === undefined
        ? {}
        : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: isFormData ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return undefined as T;

  const payload = await res.json().catch(() => null);

  if (!res.ok) throw new ApiError(res.status, payload as ApiErrorBody | null);

  return payload as T;
}
