import { useRef, useCallback } from 'react';
import { FolderOpen, Download } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { exportToAPO, importFromAPO } from '../../audio/eqProfile';
import styles from './ProfileManager.module.css';

export function ProfileManager() {
  const { bands, preampGain, loadProfile } = useAppContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const text = exportToAPO({ bands, preampGain });
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eq-profile.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [bands, preampGain]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const profile = importFromAPO(text);
        if (profile.bands.length > 0) {
          loadProfile(profile);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [loadProfile],
  );

  return (
    <div className={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt"
        className={styles.fileInput}
        onChange={handleImport}
      />
      <button
        className={styles.btn}
        onClick={() => fileInputRef.current?.click()}
        aria-label="Import EQ profile from APO .txt file"
      >
        <FolderOpen size={14} strokeWidth={2} />
        Import
      </button>
      <button
        className={styles.btn}
        onClick={handleExport}
        aria-label="Export EQ profile as APO .txt file"
      >
        <Download size={14} strokeWidth={2} />
        Export
      </button>
    </div>
  );
}
