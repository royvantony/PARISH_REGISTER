import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Key,
  Lock,
  Unlock,
  Copy,
  Check,
  Database,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const CryptoWorkbenchCard: React.FC = () => {
  const { activeParish } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<'decrypt' | 'encrypt'>('decrypt');

  // Decrypt State
  const [ciphertext, setCiphertext] = useState('');
  const [iv, setIv] = useState('');
  const [tag, setTag] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptedResult, setDecryptedResult] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // Encrypt State
  const [plaintext, setPlaintext] = useState('');
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptResult, setEncryptResult] = useState<{
    controlManifest: string;
    iv: string;
    tag: string;
  } | null>(null);
  const [encryptError, setEncryptError] = useState<string | null>(null);

  // Copy Feedback State
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleLoadActiveParishVault = async () => {
    try {
      setDecryptError(null);
      const parishId = activeParish?.id || 1;
      const res = await api.get(`/features/crypto/raw/${parishId}`);
      if (res.data) {
        setCiphertext(res.data.controlManifest || '');
        setIv(res.data.iv || '');
        setTag(res.data.tag || '');
      }
    } catch (err: any) {
      setDecryptError(err.response?.data?.error || 'Failed to load vault record from database.');
    }
  };

  const handleDecrypt = async () => {
    if (!ciphertext.trim() || !iv.trim() || !tag.trim()) {
      setDecryptError('Please provide Control Manifest (ciphertext), IV, and Auth Tag.');
      return;
    }

    setIsDecrypting(true);
    setDecryptError(null);
    setDecryptedResult(null);

    try {
      const res = await api.post('/features/crypto/decrypt', {
        ciphertext: ciphertext.trim(),
        iv: iv.trim(),
        tag: tag.trim(),
      });

      if (res.data.success) {
        setDecryptedResult(res.data.formattedJson);
      } else {
        setDecryptError(res.data.error || 'Decryption failed.');
      }
    } catch (err: any) {
      setDecryptError(err.response?.data?.error || 'Decryption failed. Ensure the ciphertext, IV, and tag match the server master key.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleEncrypt = async () => {
    if (!plaintext.trim()) {
      setEncryptError('Please enter plaintext or JSON content to encrypt.');
      return;
    }

    setIsEncrypting(true);
    setEncryptError(null);
    setEncryptResult(null);

    try {
      const res = await api.post('/features/crypto/encrypt', {
        plaintext: plaintext.trim(),
      });

      if (res.data.success) {
        setEncryptResult({
          controlManifest: res.data.controlManifest,
          iv: res.data.iv,
          tag: res.data.tag,
        });
      } else {
        setEncryptError(res.data.error || 'Encryption failed.');
      }
    } catch (err: any) {
      setEncryptError(err.response?.data?.error || 'Encryption failed.');
    } finally {
      setIsEncrypting(false);
    }
  };

  return (
    <div className="bg-parish-surface border border-parish-border rounded-2xl shadow-soft overflow-hidden transition-all">
      {/* Header / Toggle Accordion */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-parish-surface-subtle transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-parish-text">
                Database Cryptographic Workbench (AES-256-GCM)
              </h3>
              <Badge variant="warning" size="sm">
                DEV TOOL
              </Badge>
            </div>
            <p className="text-xs text-parish-text-muted mt-0.5">
              Inspect &amp; decrypt raw database records, or encrypt plain JSON into database updates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-parish-text-muted">
          <span className="text-xs font-semibold hidden sm:inline">
            {isExpanded ? 'Hide Workbench' : 'Open Workbench'}
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded Workbench Body */}
      {isExpanded && (
        <div className="border-t border-parish-border p-5 space-y-5 bg-parish-surface-subtle/40">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-2 border-b border-parish-border pb-3">
            <button
              type="button"
              onClick={() => {
                setMode('decrypt');
                setDecryptError(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === 'decrypt'
                  ? 'bg-parish-primary text-white shadow-sm'
                  : 'text-parish-text-muted hover:text-parish-text hover:bg-parish-surface'
              }`}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Decrypt Database Record</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('encrypt');
                setEncryptError(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                mode === 'encrypt'
                  ? 'bg-parish-primary text-white shadow-sm'
                  : 'text-parish-text-muted hover:text-parish-text hover:bg-parish-surface'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Encrypt Payload</span>
            </button>
          </div>

          {/* MODE 1: DECRYPT */}
          {mode === 'decrypt' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-parish-text-muted">
                  Paste the <code className="font-mono text-parish-primary font-bold">ciphertext</code>, <code className="font-mono text-parish-primary font-bold">iv</code>, and <code className="font-mono text-parish-primary font-bold">tag</code> from your database:
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLoadActiveParishVault}
                  icon={<Database className="w-3.5 h-3.5" />}
                  className="shrink-0 text-[11px]"
                >
                  Load Active Parish #{activeParish?.id || 1} from DB
                </Button>
              </div>

              {decryptError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{decryptError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-parish-text mb-1">
                    Ciphertext (Hex / Encrypted Payload)
                  </label>
                  <textarea
                    rows={3}
                    value={ciphertext}
                    onChange={(e) => setCiphertext(e.target.value)}
                    placeholder="e.g. 8f4c2e..."
                    className="w-full text-xs font-mono bg-parish-surface border border-parish-border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-parish-primary/30 text-parish-text placeholder:text-parish-text-muted"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-parish-text mb-1">
                      IV (96-bit Hex Vector)
                    </label>
                    <input
                      type="text"
                      value={iv}
                      onChange={(e) => setIv(e.target.value)}
                      placeholder="e.g. d2a893c5e01b44f7a29e1c4b"
                      className="w-full text-xs font-mono bg-parish-surface border border-parish-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-parish-primary/30 text-parish-text placeholder:text-parish-text-muted"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-parish-text mb-1">
                      Authentication Tag (128-bit Hex)
                    </label>
                    <input
                      type="text"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      placeholder="e.g. 5e1f0a99c4d28e77a1b32d00c9e4f21a"
                      className="w-full text-xs font-mono bg-parish-surface border border-parish-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-parish-primary/30 text-parish-text placeholder:text-parish-text-muted"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleDecrypt}
                    isLoading={isDecrypting}
                    icon={<Unlock className="w-3.5 h-3.5" />}
                  >
                    Decrypt Payload
                  </Button>
                </div>
              </div>

              {/* Decrypted Output Display */}
              {decryptedResult && (
                <div className="space-y-2 pt-3 border-t border-parish-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Decrypted Plaintext / JSON:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(decryptedResult, 'decrypted')}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-parish-primary hover:underline cursor-pointer"
                    >
                      {copiedKey === 'decrypted' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Plaintext</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto max-h-72 border border-slate-800">
                    {decryptedResult}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: ENCRYPT */}
          {mode === 'encrypt' && (
            <div className="space-y-4">
              <span className="text-xs text-parish-text-muted block">
                Write or paste any text or JSON below. The tool will encrypt it using the server's master AES-256-GCM key and generate the ciphertext, IV, and authentication tag for copying into the database.
              </span>

              {encryptError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{encryptError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-parish-text">
                      Plaintext / JSON Payload
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPlaintext(
                          JSON.stringify(
                            [
                              { key: 'PAGE_REGISTER', isEnabled: true },
                              { key: 'PAGE_USERS', isEnabled: true },
                            ],
                            null,
                            2
                          )
                        )
                      }
                      className="text-[10px] text-parish-primary hover:underline cursor-pointer"
                    >
                      Insert Example JSON
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={plaintext}
                    onChange={(e) => setPlaintext(e.target.value)}
                    placeholder='{"example": "Hello World"}'
                    className="w-full text-xs font-mono bg-parish-surface border border-parish-border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-parish-primary/30 text-parish-text placeholder:text-parish-text-muted"
                  />
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleEncrypt}
                    isLoading={isEncrypting}
                    icon={<Lock className="w-3.5 h-3.5" />}
                  >
                    Encrypt to AES-256-GCM
                  </Button>
                </div>
              </div>

              {/* Encryption Result Output */}
              {encryptResult && (
                <div className="space-y-3 pt-3 border-t border-parish-border">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Encrypted Cryptographic Artifacts:
                  </span>

                  <div className="space-y-2">
                    {/* Ciphertext */}
                    <div className="p-2.5 rounded-xl bg-parish-surface border border-parish-border flex items-center justify-between gap-3 text-xs">
                      <div className="flex-1 truncate">
                        <span className="text-[10px] font-bold text-parish-text-muted uppercase block">
                          Ciphertext (Encrypted Payload):
                        </span>
                        <span className="font-mono text-parish-text text-[11px] truncate block select-all">
                          {encryptResult.controlManifest}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(encryptResult.controlManifest, 'cipher')}
                        className="p-1.5 hover:bg-parish-surface-subtle rounded-lg text-parish-primary shrink-0 cursor-pointer"
                        title="Copy Ciphertext"
                      >
                        {copiedKey === 'cipher' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* IV & Tag */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-xl bg-parish-surface border border-parish-border flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 truncate">
                          <span className="text-[10px] font-bold text-parish-text-muted uppercase block">
                            IV:
                          </span>
                          <span className="font-mono text-parish-text text-[11px] truncate block select-all">
                            {encryptResult.iv}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(encryptResult.iv, 'iv')}
                          className="p-1.5 hover:bg-parish-surface-subtle rounded-lg text-parish-primary shrink-0 cursor-pointer"
                          title="Copy IV"
                        >
                          {copiedKey === 'iv' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="p-2.5 rounded-xl bg-parish-surface border border-parish-border flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 truncate">
                          <span className="text-[10px] font-bold text-parish-text-muted uppercase block">
                            Auth Tag:
                          </span>
                          <span className="font-mono text-parish-text text-[11px] truncate block select-all">
                            {encryptResult.tag}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(encryptResult.tag, 'tag')}
                          className="p-1.5 hover:bg-parish-surface-subtle rounded-lg text-parish-primary shrink-0 cursor-pointer"
                          title="Copy Tag"
                        >
                          {copiedKey === 'tag' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
