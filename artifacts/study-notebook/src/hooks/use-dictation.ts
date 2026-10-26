import { useEffect, useRef, useState } from 'react';

// Web Speech is available in some browsers under its vendor-prefixed name.
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function useDictation(draft: string, setDraft: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const base = useRef('');
  const browser = window as SpeechWindow;
  const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  const supported = !!Constructor;

  useEffect(() => () => {
    const current = recognition.current;
    if (current) {
      current.onresult = null;
      current.onerror = null;
      current.onend = null;
      current.abort();
    }
  }, []);

  function stop() {
    recognition.current?.stop();
    setListening(false);
  }

  function toggle() {
    if (listening) { stop(); return; }
    if (!Constructor) return;
    // A previous recognition can still be ending after stop().
    if (recognition.current) {
      recognition.current.onresult = null;
      recognition.current.onerror = null;
      recognition.current.onend = null;
      recognition.current.abort();
    }
    setError('');
    base.current = draft.trimEnd();
    const current = new Constructor();
    recognition.current = current;
    current.lang = 'en-US';
    current.continuous = true;
    current.interimResults = true;
    current.onresult = (event) => {
      if (recognition.current !== current) return;
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' ').trim();
      setDraft(`${base.current}${base.current && transcript ? ' ' : ''}${transcript}`.slice(0, 6000));
    };
    current.onerror = ({ error: code }) => {
      if (recognition.current !== current) return;
      setError(code === 'not-allowed' || code === 'service-not-allowed'
        ? 'Microphone access was denied. Allow it in your browser’s site settings, or keep typing.'
        : code === 'no-speech' ? 'No speech detected. Try again, or type your message.'
        : code === 'audio-capture' ? 'No microphone was found. Connect one, or keep typing.'
        : `Dictation stopped (${code}). Try again or type your message.`);
      setListening(false);
    };
    current.onend = () => {
      if (recognition.current === current) {
        recognition.current = null;
        setListening(false);
      }
    };
    try { current.start(); setListening(true); }
    catch {
      recognition.current = null;
      setError('Could not start dictation. Try again or type your message.');
    }
  }
  function cancel() {
    const current = recognition.current;
    recognition.current = null;
    if (current) {
      current.onresult = null;
      current.onerror = null;
      current.onend = null;
      current.abort();
    }
    setListening(false);
  }
  return { supported, listening, error, toggle, stop, cancel };
}
