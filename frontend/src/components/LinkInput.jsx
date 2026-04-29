import { ClipboardPaste } from 'lucide-react';
import { t } from '../i18n';

export default function LinkInput({ label, value, onChange, lang = 'en', placeholder = 'https://youtube.com/...' }) {
  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch {
      alert('Clipboard is not available. Use HTTPS or localhost and allow clipboard permissions.');
    }
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div className="paste-input">
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
        <button type="button" className="small-btn" onClick={pasteFromClipboard}>
          <ClipboardPaste size={16} /> {t(lang, 'paste')}
        </button>
      </div>
    </label>
  );
}
