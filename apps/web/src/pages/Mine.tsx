import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel } from '../components/Panel.js';
import { useMe } from '../hooks/useMe.js';
import { api } from '../api.js';

type Status = 'idle' | 'mining' | 'submitting' | 'error';

export function MinePage() {
  const { me, loading, refresh } = useMe();
  const nav = useNavigate();
  const [status, setStatus] = useState<Status>('idle');
  const [target, setTarget] = useState<number | null>(null);
  const [hashes, setHashes] = useState('0');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [lastTokenId, setLastTokenId] = useState('');
  const [sessionMinted, setSessionMinted] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  // Use a ref (not state) so the async worker callback always sees the latest value
  // without restarting the loop closure.
  const stopRequestedRef = useRef(false);

  useEffect(() => () => {
    stopRequestedRef.current = true;
    workerRef.current?.terminate();
  }, []);

  async function startOne() {
    if (stopRequestedRef.current) { setStatus('idle'); return; }
    setStatus('mining');
    setError('');
    setHashes('0');
    setElapsed(0);

    let ch;
    try {
      ch = await api.challenge();
    } catch (err: any) {
      setStatus('error');
      setError(err?.message ?? 'failed to fetch challenge');
      return;
    }
    setTarget(ch.difficulty_bits);

    const w = new Worker(new URL('../miner.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = async (e: MessageEvent<any>) => {
      const m = e.data;
      if (m.type === 'progress') { setHashes(m.hashes); setElapsed(m.elapsed_ms); return; }
      if (m.type === 'aborted') {
        w.terminate(); workerRef.current = null;
        setStatus('idle');
        return;
      }
      if (m.type === 'found') {
        setStatus('submitting');
        w.terminate(); workerRef.current = null;
        try {
          const r = await api.mint({ challenge_id: ch.challenge_id, solution_nonce: m.solution_nonce });
          setLastTokenId(r.token.id);
          setSessionMinted(n => n + 1);
          await refresh();
          // Loop: kick off the next challenge unless the user asked to stop.
          if (!stopRequestedRef.current) {
            startOne();
          } else {
            setStatus('idle');
          }
        } catch (err: any) {
          setStatus('error');
          setError(err?.message ?? 'mint failed');
        }
      }
    };
    w.postMessage({ type: 'start', nonce_prefix: ch.nonce_prefix, difficulty_bits: ch.difficulty_bits });
  }

  function start() {
    if (!me) { nav('/login'); return; }
    stopRequestedRef.current = false;
    setSessionMinted(0);
    setLastTokenId('');
    startOne();
  }

  function stop() {
    stopRequestedRef.current = true;
    workerRef.current?.postMessage({ type: 'abort' });
  }

  function fmtRate() {
    if (!elapsed) return '0';
    const h = Number(hashes);
    const mhs = (h / 1e6) / (elapsed / 1000);
    return mhs.toFixed(2) + ' MH/s';
  }
  function fmtElapsed() {
    const s = Math.floor(elapsed / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `00:${mm}:${ss}`;
  }

  if (loading) return <Panel><div>loading...</div></Panel>;
  if (!me) return <Panel title="MINE"><div>not signed in.</div></Panel>;

  const running = status === 'mining' || status === 'submitting';

  return (
    <Panel title="MINE">
      <pre style={{ margin: 0 }}>
{`  TARGET           : ${target ?? '--'} trailing zero bits
  HASHES (current) : ${Number(hashes).toLocaleString()}
  RATE             : ${fmtRate()}
  ELAPSED          : ${fmtElapsed()}
  STATUS           : ${status.toUpperCase()}
  MINED THIS RUN   : ${sessionMinted}${lastTokenId ? `\n  LAST TOKEN       : ${lastTokenId}` : ''}${error ? `\n  ERROR            : ${error}` : ''}
`}
      </pre>
      <div style={{ marginTop: 8 }}>
        {running ? (
          <button onClick={stop}>[ STOP ]</button>
        ) : (
          <button onClick={start}>[ MINE ]</button>
        )}
      </div>
    </Panel>
  );
}
