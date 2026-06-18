import { useState } from 'react';
import { SafetyModal } from '../SafetyModal/SafetyModal';
import styles from './Footer.module.css';

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="privacy-heading">
      <div className={styles.privacyModal}>
        <div className={styles.privacyHeader}>
          <h2 id="privacy-heading" className={styles.privacyTitle}>Privacy Policy</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close privacy notice">×</button>
        </div>

        <div className={styles.privacyBody}>
          <section>
            <h3 className={styles.privacySectionHeading}>No audio or health data collection</h3>
            <p>
              Your hearing data, EQ presets, and any uploaded audio files are processed entirely
              client-side within your browser session memory or localStorage. No data is
              transmitted to, stored on, or processed by a remote server.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>Data storage</h3>
            <p>
              Only your theme preference and safety acknowledgement are written to{' '}
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
            <h3 className={styles.privacySectionHeading}>EU GDPR compliance</h3>
            <p>
              No personal data is collected, transmitted, or processed by this application on any
              server. Hearing calibration data and audio files remain entirely within your browser
              and are not accessible to the operator or any third party. Accordingly, no legal
              basis for processing under EU GDPR Article 6 or Article 9 (special category health
              data) is required, as no such processing takes place.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>US state health privacy (incl. MHMDA)</h3>
            <p>
              This application does not collect, sell, or share consumer health data as defined
              under Washington State's My Health My Data Act (MHMDA) or equivalent state laws.
              All hearing-related data is processed locally on your device and never transmitted
              to any server, third party, or analytics service. No health data is retained beyond
              your current browser session unless you explicitly export a profile file to your own
              device.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>COPPA (children's privacy)</h3>
            <p>
              This application is not directed at children under 13. No personal information is
              collected from any user, including children. The Safety Notice displayed on first
              use restricts use to persons aged 18 and over. No parental consent mechanism is
              required as no data is collected from any age group.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>Automated disclosures (EU AI Act)</h3>
            <p>
              Any configuration tools or wizard suggestions within this application are purely
              deterministic calculations run locally on your device to assist with manual audio
              calibration. No machine learning models, AI inference, or automated decision-making
              systems are used. No provisions of the EU AI Act apply.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>Accessibility</h3>
            <p>
              This application is designed to comply with WCAG 2.2 Level AA, in accordance with
              the Equality Act 2010 (UK) and the European Accessibility Act (EU). If you encounter
              an accessibility barrier, please contact us.
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
            Privacy Policy
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
