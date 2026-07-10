import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { motion } from 'framer-motion';
import { Sun, Moon, Ear, Lock, Gauge } from 'lucide-react';
import { AppProvider } from './context/AppContext';
import { EQCurve } from './components/EQCurve/EQCurve';
import { EQBandControl } from './components/EQBandControl/EQBandControl';
import { OscillatorControl } from './components/OscillatorControl/OscillatorControl';
import { AudioFilePlayer } from './components/AudioFilePlayer/AudioFilePlayer';
import { ProfileManager } from './components/ProfileManager/ProfileManager';
import { PanicButton } from './components/PanicButton/PanicButton';
import { Footer } from './components/Footer/Footer';
import { SafetyModal } from './components/SafetyModal/SafetyModal';
import { Wizard } from './components/Wizard/Wizard';
import { useTheme } from './hooks/useTheme';
import './styles/globals.css';
import styles from './App.module.css';

function InstructionsModal({ onClose }: { onClose: () => void }) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll<HTMLElement>('button, a[href], [tabindex="0"]');
    focusable[0]?.focus();

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const steps = [
    {
      heading: 'Find the peaks and troughs',
      body: 'Play the oscillator and sweep it slowly across the frequency range. Listen for frequencies that sound noticeably louder (a peak) or quieter (a trough) than those around them.',
    },
    {
      heading: 'Correct with EQ',
      body: 'Add a parametric band for each anomaly you find. Cut the gain at a peak, boost it at a trough. Adjust the frequency, gain, and Q until the anomaly has audibly gone.',
    },
    {
      heading: 'Flatten the response',
      body: "You're done when the oscillator has a consistent perceived volume throughout the full sweep — 20 Hz to 20 kHz.",
    },
    {
      heading: 'Test with music',
      body: 'Upload an audio file to hear it through your profile. Use the A/B button in the EQ panel to compare the corrected and uncorrected sound — if the EQ version sounds more balanced and natural, your profile is ready.',
    },
  ];

  return (
    <div className={styles.instructionsOverlay} role="dialog" aria-modal="true" aria-labelledby="instructions-heading">
      <div className={styles.instructionsModal} ref={modalRef}>
        <div className={styles.instructionsHeader}>
          <h2 id="instructions-heading" className={styles.instructionsTitle}>How to use Uniqualiser</h2>
          <button className={styles.instructionsClose} onClick={onClose} aria-label="Close instructions">×</button>
        </div>
        <div className={styles.instructionsBody}>
          <p className={styles.instructionsIntro}>
            Uniqualiser helps you identify how your headphones colour the sound and build a personalised EQ to correct it.
          </p>
          <ol className={styles.stepList}>
            {steps.map((step, i) => (
              <li key={i} className={styles.step}>
                <span className={styles.stepNumber}>{i + 1}</span>
                <div>
                  <p className={styles.stepHeading}>{step.heading}</p>
                  <p className={styles.stepBody}>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className={styles.instructionsFooter}>
          <button className={styles.instructionsDone} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

function Header({ onToggleTheme, theme }: { onToggleTheme: () => void; theme: string }) {
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <Link to="/" className={styles.logo}>
          <img src="/eq-icon.svg" alt="" className={styles.logoIcon} width={28} height={28} />
          Uniqualiser
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          <button
            className={styles.navButton}
            onClick={() => setShowInstructions(true)}
            aria-label="How to use Uniqualiser"
          >
            How to use
          </button>
        </nav>
        <div className={styles.headerRight}>
          <button
            className={styles.themeToggle}
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={15} strokeWidth={2} /> : <Sun size={15} strokeWidth={2} />}
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
          <ProfileManager />
        </div>
      </header>
      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}
    </>
  );
}

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

function HeroVisual() {
  const handles = [
    { cx: 62, cy: 44 },
    { cx: 170, cy: 152 },
    { cx: 268, cy: 76 },
  ];

  return (
    <div className={styles.heroVisual} aria-hidden="true">
      <svg viewBox="0 0 340 200" className={styles.heroVisualSvg}>
        <g className={styles.heroGrid}>
          <line x1="0" y1="40" x2="340" y2="40" />
          <line x1="0" y1="80" x2="340" y2="80" />
          <line x1="0" y1="120" x2="340" y2="120" />
          <line x1="0" y1="160" x2="340" y2="160" />
          <line x1="56" y1="0" x2="56" y2="200" />
          <line x1="112" y1="0" x2="112" y2="200" />
          <line x1="168" y1="0" x2="168" y2="200" />
          <line x1="224" y1="0" x2="224" y2="200" />
          <line x1="280" y1="0" x2="280" y2="200" />
        </g>
        <line x1="0" y1="100" x2="340" y2="100" className={styles.heroZeroLine} />
        <path
          className={styles.heroCurveGlow}
          d="M -10 90 C 20 90, 40 44, 62 44 C 90 44, 130 152, 170 152 C 210 152, 235 76, 268 76 C 295 76, 320 92, 350 90"
        />
        <path
          className={styles.heroCurve}
          d="M -10 90 C 20 90, 40 44, 62 44 C 90 44, 130 152, 170 152 C 210 152, 235 76, 268 76 C 295 76, 320 92, 350 90"
        />
        {handles.map((h, i) => (
          <motion.circle
            key={i}
            cx={h.cx}
            cy={h.cy}
            r="6"
            className={styles.heroHandle}
            animate={{ cy: [h.cy, h.cy - 4, h.cy] }}
            transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
          />
        ))}
      </svg>
    </div>
  );
}

function IntroCard() {
  return (
    <section className={styles.introCard} aria-label="About Uniqualiser">
      <div className={styles.introHero}>
        <div className={styles.introHeroText}>
          <h2 className={styles.introHeading}>Hear your headphones the way you actually hear them</h2>
          <p className={styles.introLead}>
            Uniqualiser is a free, browser-based tool for building a personalised parametric EQ profile
            for your headphones — tuned to your own hearing, not a generic manufacturer measurement. You
            sweep a tone across the audible range to find the peaks and dips unique to your ears, correct
            them with a parametric equaliser, then verify the result against your own music.
          </p>
          <div className={styles.introChips}>
            <span className={styles.introChip}><Ear size={13} strokeWidth={2.2} /> Tuned by ear, 20 Hz–20 kHz</span>
            <span className={styles.introChip}><Lock size={13} strokeWidth={2.2} /> 100% private, runs in-browser</span>
            <span className={styles.introChip}><Gauge size={13} strokeWidth={2.2} /> Free, no signup</span>
          </div>
        </div>
        <HeroVisual />
      </div>
      <h2 className={styles.introTitle}>Why personalise your EQ?</h2>
      <div className={styles.introColumns}>
        <div className={styles.introCol}>
          <p className={styles.introBody}>
            Tools like AutoEQ make it easy to apply a headphone correction curve against a measured
            target. The catch is that your head-related transfer function (HRTF) — unique to your
            ear and skull geometry — has a significant effect on how sound actually reaches your
            eardrums. A profile derived from manufacturer measurements will sound quite different
            depending on who's wearing the headphones.
          </p>
        </div>
        <div className={styles.introCol}>
          <p className={styles.introBody}>
            HRTF variation is most pronounced above 1 kHz. A practical workflow is to apply an
            AutoEQ correction for the bass and low-mids first, then use Uniqualiser to fine-tune
            the upper frequencies by ear — until the oscillator sweep sounds even and flat to you.
          </p>
          <a
            href="https://www.youtube.com/watch?v=s0nZCXyDTz4&t=299s"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.introLink}
          >
            Watch: The Headphone Show on the scale of this problem →
          </a>
        </div>
      </div>
    </section>
  );
}

function MainLayout() {
  return (
    <main className={styles.main} id="main-content">
      <h1 className={styles.srOnly}>
        Uniqualiser — Personalised Headphone EQ Profiler Based on Your Own Hearing
      </h1>
      <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ duration: 0.2, ease: 'easeOut', delay: 0 }}>
        <IntroCard />
      </motion.div>
      <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ duration: 0.2, ease: 'easeOut', delay: 0.05 }}>
        <OscillatorControl />
      </motion.div>
      <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ duration: 0.2, ease: 'easeOut', delay: 0.1 }}>
        <EQCurve />
      </motion.div>
      <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ duration: 0.2, ease: 'easeOut', delay: 0.15 }}>
        <EQBandControl />
      </motion.div>
      <motion.div variants={cardVariants} initial="hidden" animate="visible" transition={{ duration: 0.2, ease: 'easeOut', delay: 0.2 }}>
        <AudioFilePlayer />
      </motion.div>
    </main>
  );
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [safetyAccepted, setSafetyAccepted] = useState(false);

  function handleAccept() {
    setSafetyAccepted(true);
  }

  return (
    <>
      {!safetyAccepted && <SafetyModal onAccept={handleAccept} />}
      <BrowserRouter>
        <AppProvider safetyAccepted={safetyAccepted}>
          <TooltipPrimitive.Provider delayDuration={700}>
            <div className={styles.app} aria-hidden={!safetyAccepted || undefined}>
              <a href="#main-content" className={styles.skipLink}>Skip to main content</a>
              <Header onToggleTheme={toggleTheme} theme={theme} />
              <Routes>
                <Route path="/" element={<MainLayout />} />
                <Route path="/wizard" element={<Wizard />} />
              </Routes>
              <Footer />
              <PanicButton />
            </div>
          </TooltipPrimitive.Provider>
        </AppProvider>
      </BrowserRouter>
    </>
  );
}
