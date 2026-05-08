import { useState } from 'react';
import { Panel } from '../components/Panel.js';
import { api } from '../api.js';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending'); setError('');
    try {
      await api.authRequest({ email });
      setStatus('sent');
    } catch (err: any) {
      setStatus('error');
      setError(err?.message ?? 'unknown error');
    }
  }

  return (
    <Panel title="LOGIN">
      <form onSubmit={submit}>
        <div>
          EMAIL : <input value={email} onChange={e => setEmail(e.target.value)} required type="email" autoFocus style={{ width: '36ch' }} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button type="submit" disabled={status === 'sending' || status === 'sent'}>
            {status === 'sending' ? '[ ... ]' : status === 'sent' ? '[ LINK SENT ]' : '[ SEND LINK ]'}
          </button>
        </div>
        {status === 'sent' && <div style={{ marginTop: 8 }}>check your inbox. the link expires in 15 minutes.</div>}
        {status === 'error' && <div className="error" style={{ marginTop: 8 }}>error: {error}</div>}
      </form>
    </Panel>
  );
}
