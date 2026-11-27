'use client';
import { useActionState } from 'react';
import { login, type LoginState } from './actions';

export function LoginForm({ next, disabled }: { next?: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="stack" noValidate>
      <input type="hidden" name="lanjut" value={next ?? ''} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required disabled={disabled} />
      </div>
      <div className="field">
        <label htmlFor="password">Kata sandi</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} disabled={disabled} />
      </div>
      {state.error ? (
        <div className="notice notice-danger" role="alert"><strong>Gagal masuk</strong>{state.error}</div>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={disabled || pending}>{pending ? 'Memproses…' : 'Masuk'}</button>
    </form>
  );
}
