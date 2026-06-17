import { useState, useRef, useEffect } from 'react';
import styles from './SafetyModal.module.css';

interface Props {
  onAccept?: () => void;
  onClose?: () => void;
  mode?: 'gate' | 'review';
}

export function SafetyModal({ onAccept, onClose, mode = 'gate' }: Props) {
  const [checked, setChecked] = useState(false);
  const isReview = mode === 'review';
  const modalRef = useRef<HTMLDivElement>(null);
  const headingId = 'safety-modal-heading';

  // Focus trap: keep keyboard focus inside the modal while it is open
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, input[type="checkbox"], a[href], [tabindex="0"]',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }

    document.addEventListener('keydown', trap);
    return () => document.removeEventListener('keydown', trap);
  }, []);

  return (
    <div className={styles.overlay} aria-modal="true" role="dialog" aria-labelledby={headingId}>
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.warningBadge} aria-hidden="true">⚠</div>

        <h1 id={headingId} className={styles.heading}>Safety notice</h1>

        <div className={styles.body}>
          <section>
            <h2 className={styles.sectionHeading}>Risk of hearing damage</h2>
            <p>
              This tool generates pure sine tones and sweeps across the full audible spectrum
              (20 Hz – 20,000 Hz). Pure tones can sound dramatically louder or quieter at certain
              frequencies than wideband audio, due to the uneven frequency sensitivity of human
              hearing (the equal-loudness contours). A frequency that appears quiet at one point
              in a sweep may cause a sudden, intense perceived loudness peak moments later.
            </p>
            <p>
              Exposure to loud tones — even briefly — can cause permanent hearing damage,
              including <strong>tinnitus</strong> (ringing in the ears) and noise-induced hearing
              loss (NIHL). These conditions are irreversible.
            </p>
          </section>

          <section className={styles.actionSection}>
            <h2 className={styles.sectionHeading}>Before you start — required action</h2>
            <p>
              <strong>Lower your hardware volume to the minimum</strong> before clicking Accept.
              Begin with your volume at its lowest setting and raise it very gradually once the
              tool is running. Never use this tool at high volume levels or for extended periods.
            </p>
            <p>
              If you experience any discomfort, pain, or ringing, stop immediately and seek
              medical advice.
            </p>
          </section>

          <section className={styles.disclaimerSection}>
            <h2 className={styles.sectionHeading}>Disclaimer of liability</h2>
            <p>
              This tool is provided for personal and educational use only. By proceeding, you
              acknowledge and agree that:
            </p>
            <ul>
              <li>
                Use of this tool is entirely <strong>at your own risk</strong>.
              </li>
              <li>
                The developer accepts <strong>no liability</strong> for any hearing damage,
                tinnitus, auditory injury, or hardware damage arising from use of this tool.
              </li>
              <li>
                You are solely responsible for setting safe volume levels on your hardware
                before and during use.
              </li>
              <li>
                This tool does not constitute medical or audiological advice. Consult a qualified
                audiologist for professional hearing assessment.
              </li>
              <li>
                This tool is <strong>not intended for use by anyone under the age of 18.</strong>{' '}
                If you are under 18, a parent or guardian must read and accept these terms on
                your behalf before you use this tool, and must supervise your use at all times.
              </li>
            </ul>
          </section>
        </div>

        <div className={styles.footer}>
          {isReview ? (
            <button className={styles.acceptBtn} onClick={onClose} aria-label="Close safety notice">
              Close
            </button>
          ) : (
            <>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  aria-label="I have read all warnings and agree to use this tool at my own risk"
                />
                <span>
                  I have read and understood the warnings above and agree to use this tool
                  entirely at my own risk
                </span>
              </label>
              <button
                className={styles.acceptBtn}
                onClick={onAccept}
                disabled={!checked}
                aria-disabled={!checked}
              >
                Accept and continue
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
