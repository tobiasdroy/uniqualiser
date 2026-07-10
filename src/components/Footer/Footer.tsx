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
            <h3 className={styles.privacySectionHeading}>Site analytics</h3>
            <p>
              We use Cloudflare Web Analytics to see aggregate traffic to this site — for example,
              visit counts, referring sites, and country of origin. It is cookieless, sets no
              persistent identifier, and cannot track you across other websites. It is entirely
              separate from the hearing calibration tool: no EQ profile, audio file, or hearing
              data is ever included. Cloudflare processes standard web request metadata (such as
              IP address, at the point of request) as our data processor, solely to produce
              anonymised, aggregated traffic statistics.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>UK GDPR &amp; DUAA compliance</h3>
            <p>
              This application sets no tracking or cross-site cookies, and Cloudflare Web
              Analytics (see above) is cookieless and uses no persistent identifier — so no
              consent banner is required under the UK Data Use and Access Act (DUAA)'s rules for
              non-essential storage. Our use of anonymised, aggregate traffic data relies on
              legitimate interest under UK GDPR Article 6(1)(f), necessary to understand and
              maintain the service. No hearing or health data ever reaches a server, so no further
              UK GDPR processing obligations arise from the calibration tool itself.
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>EU GDPR compliance</h3>
            <p>
              Hearing calibration data and audio files remain entirely within your browser and are
              never transmitted to, or accessible by, the operator or any third party —
              accordingly no legal basis under EU GDPR Article 9 (special category health data) is
              required, as no such processing takes place. Separately, this site uses Cloudflare
              Web Analytics to process minimal technical data (e.g. IP address, at the point of
              request) for anonymised, aggregate traffic reporting. This limited processing does
              not identify individuals and relies on legitimate interest under EU GDPR Article
              6(1)(f).
            </p>
          </section>

          <section>
            <h3 className={styles.privacySectionHeading}>US state health privacy (incl. MHMDA)</h3>
            <p>
              This application does not collect, sell, or share consumer health data as defined
              under Washington State's My Health My Data Act (MHMDA) or equivalent state laws.
              All hearing-related data is processed locally on your device and is never
              transmitted to any server, third party, or analytics service — this remains true
              even though the site uses Cloudflare Web Analytics for anonymous traffic statistics,
              since no hearing or health data of any kind is included in that data. No health data
              is retained beyond your current browser session unless you explicitly export a
              profile file to your own device.
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
          All audio processing happens locally on your device and is never uploaded or shared.
        </p>
        <div className={styles.links}>
          <a
            href="mailto:tobias.droy@gmail.com?subject=Uniqualiser%20feedback"
            className={styles.footerLink}
            aria-label="Send feedback by email"
          >
            Feedback
          </a>
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
