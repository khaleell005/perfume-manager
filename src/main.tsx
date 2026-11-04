import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Brand, btn } from './ui';
import './index.css';
import './theme';
import './pwa';
import { BusinessProvider } from './business';
import { PwaStatus } from './PwaControls';

const root = createRoot(document.getElementById('root')!);

function StartupMessage({ children }: { children: ReactNode }) {
  return (
    <main className="startup-layout">
      <section className="startup-card"><Brand />{children}</section>
    </main>
  );
}

async function start() {
  root.render(<StartupMessage><p role="status">Loading…</p></StartupMessage>);
  try {
    const { default: App } = await import('./App');
    root.render(<StrictMode><BusinessProvider><BrowserRouter><App /><PwaStatus /></BrowserRouter></BusinessProvider></StrictMode>);
  } catch (error) {
    console.error('Unable to start Perfume Manager:', error);
    root.render(
      <StartupMessage>
        <h2 className="font-semibold">Unable to start the app</h2>
        <p>Reload the page to try again. If the problem continues, check that the workspace server is running and see the browser console for details.</p>
        <button className={btn} onClick={() => window.location.reload()}>Reload</button>
      </StartupMessage>
    );
  }
}

void start();
