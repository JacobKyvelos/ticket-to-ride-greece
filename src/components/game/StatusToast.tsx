import { useEffect, useState } from 'react';

interface StatusToastProps {
  message: string;
  tone?: 'info' | 'error';
  durationMs?: number;
}

export function StatusToast({ message, tone = 'info', durationMs = 2800 }: StatusToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return undefined;
    }

    setVisible(true);
    const timeoutId = window.setTimeout(() => setVisible(false), durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [durationMs, message]);

  if (!message) {
    return null;
  }

  return (
    <div className="status-toast" data-visible={visible} data-tone={tone} role="status">
      {message}
    </div>
  );
}
