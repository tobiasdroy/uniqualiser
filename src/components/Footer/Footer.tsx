import { useState } from 'react';
import { SafetyModal } from '../SafetyModal/SafetyModal';
import styles from './Footer.module.css';

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="privacy-heading">
      <div className={styles.privacyModal}>
        <div className={styles.privacyHeader}>
          <h2 id="privacy-heading" className={styles.privacyTitle}>Privacy &amp; Compliance</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close privacy notice">×</button>
        </div>

        <div className={styles.privacyBody}>
          <section>
            <h3 className={styles.privacySectionHeading}>Local-first processing</h3>
            <p>
              PersonalisedEQ processes all audio entirely within your browser using the Web Audio
              API. Your audio files, hearing test results, and EQ profile data never leave your
              device. No data is transmitted to any server at any time.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>Data storage</h3>
            <p>
              Your EQ profile preferences (theme setting) are stored in your browser's{' '}
              <code>localStorage</code>. This is local to your device, is never shared with
              third parties, and can be cleared at any time via your browser settings. No cookies
              are set by this application.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>UK GDPR &amp; DUAA compliance</h3>
            <p>
              Because this application processes no personal data on any server and sets no
              tracking cookies, it falls outside the scope of UK GDPR data-controller obligations
              and the consent requirements of the UK Data Use and Access Act (DUAA) for
              non-essential storage. No consent banner is required or shown.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>Accessibility</h3>
            <p>
              This application is designed to comply with WCAG 2.2 Level AA, in accordance with
              the Equality Act 2010. If you encounter an accessibility barrier, please contact us.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>Contact</h3>
            <p>
              Questions or accessibility concerns?{' '}
              <a href="mailto:tobias.droy@gmail.com" className={styles.link}>
                tobias.droy@gmail.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSafety, setShowSafety] = useState(false);

  return (
    <>
      <footer className={styles.footer}>
        <p className={styles.notice}>
          All audio processing happens locally on your device. No data is uploaded or shared.
        </p>
        <div className={styles.links}>
          <button className={styles.footerLink} onClick={() => setShowSafety(true)}>
            Safety Notice
          </button>
          <button className={styles.footerLink} onClick={() => setShowPrivacy(true)}>
            Privacy &amp; Compliance
          </button>
        </div>
      </footer>

      {showSafety && (
        <SafetyModal mode="review" onClose={() => setShowSafety(false)} />
      )}
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </>
  );
}
