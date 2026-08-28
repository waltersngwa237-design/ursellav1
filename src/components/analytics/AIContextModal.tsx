import React, { useState } from 'react';
import { Modal } from '../common/Modal.tsx';
import { Button } from '../common/Button.tsx';
import { Copy, Check, Sparkles, Code2 } from 'lucide-react';
import type { AIBusinessContextPayload } from '../../types/index.ts';

interface AIContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: AIBusinessContextPayload | null;
}

export const AIContextModal: React.FC<AIContextModalProps> = ({
  isOpen,
  onClose,
  payload,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!payload) return;
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Authoritative AI Business Context"
      maxWidth="xl"
    >
      <div className="space-y-4">
        <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-400 space-y-1">
          <div className="flex items-center gap-2 font-bold text-zinc-200">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Factual Grounding Layer for Google Gemini
          </div>
          <p className="text-zinc-400">
            This structured JSON object represents verified business facts computed by the Ursella engine.
            Gemini receives this clean context to provide advisory intelligence with complete mathematical grounding.
          </p>
        </div>

        <div className="relative">
          <pre className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-mono text-emerald-400 max-h-96 overflow-y-auto scrollbar-thin">
            {payload ? JSON.stringify(payload, null, 2) : '// Loading context facts...'}
          </pre>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            className="absolute top-3 right-3 text-xs bg-zinc-900/80 backdrop-blur"
          >
            {copied ? 'Copied JSON' : 'Copy JSON'}
          </Button>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close Inspector
          </Button>
        </div>
      </div>
    </Modal>
  );
};
