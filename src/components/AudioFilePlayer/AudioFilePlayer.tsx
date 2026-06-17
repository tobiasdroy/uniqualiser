import { useState, useCallback, useRef, useEffect } from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Music } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import styles from './AudioFilePlayer.module.css';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioFilePlayer() {
  const { engineRef, initEngine, isEngineReady } = useAppContext();
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPlayingRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { isScrubbingRef.current = isScrubbing; }, [isScrubbing]);

  useEffect(() => {
    if (!fileName) return;
    const tick = () => {
      const engine = engineRef.current;
      if (engine && !isScrubbingRef.current) {
        const pos = Math.min(engine.getFilePosition(), engine.getFileDuration());
        setCurrentTime(pos);
        if (isPlayingRef.current && !engine.getIsFilePlaying()) {
          isPlayingRef.current = false;
          setIsPlaying(false);
          setCurrentTime(0);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [fileName, engineRef]);

  const loadFile = useCallback(
    async (file: File) => {
      if (!isEngineReady) await initEngine();
      const engine = engineRef.current!;
      const buffer = await file.arrayBuffer();
      await engine.loadFile(buffer);
      setFileName(file.name);
      setDuration(engine.getFileDuration());
      setCurrentTime(0);
      setIsPlaying(false);
    },
    [engineRef, initEngine, isEngineReady],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadFile(file);
      e.target.value = '';
    },
    [loadFile],
  );

  const handlePlayPause = useCallback(async () => {
    if (!isEngineReady) await initEngine();
    const engine = engineRef.current!;
    if (!engine.hasAudioFile()) return;

    if (isPlaying) {
      engine.pauseFile();
      setIsPlaying(false);
    } else {
      await engine.startFile(engine.getFilePosition(), () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
      setIsPlaying(true);
    }
  }, [isEngineReady, initEngine, engineRef, isPlaying]);

  const handleScrubStart = useCallback(() => {
    setIsScrubbing(true);
    setScrubValue(engineRef.current?.getFilePosition() ?? 0);
  }, [engineRef]);

  const handleScrubChange = useCallback(([v]: number[]) => {
    setScrubValue(v);
  }, []);

  const handleScrubCommit = useCallback(async ([v]: number[]) => {
    setIsScrubbing(false);
    setCurrentTime(v);
    await engineRef.current?.seekFile(v);
    if (engineRef.current?.getIsFilePlaying()) setIsPlaying(true);
  }, [engineRef]);

  const scrubberValue = isScrubbing ? scrubValue : currentTime;

  return (
    <section className={styles.container} aria-label="Audio file player">
      <div className={styles.header}>
        <span className={styles.title}>Audio File</span>
      </div>

      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ''} ${fileName ? styles.hasFile : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label={fileName ? `Loaded: ${fileName}. Click to load a different file` : 'Upload audio file — click or drag and drop'}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className={styles.fileInput}
          onChange={handleFileInput}
          aria-hidden="true"
          tabIndex={-1}
        />
        {fileName ? (
          <span className={styles.fileName}>{fileName}</span>
        ) : (
          <span className={styles.dropHint}>
            <Music size={22} aria-hidden="true" className={styles.dropIcon} />
            Drop audio file or click to browse
          </span>
        )}
      </div>

      <AnimatePresence>
        {fileName && (
          <motion.div
            key="transport"
            className={styles.transport}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            <button
              className={`${styles.playBtn} ${isPlaying ? styles.active : ''}`}
              onClick={handlePlayPause}
              aria-label={isPlaying ? 'Pause audio file' : 'Play audio file'}
              aria-pressed={isPlaying}
            >
              {isPlaying
                ? <Pause size={13} strokeWidth={2.5} />
                : <Play size={13} strokeWidth={2.5} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <div className={styles.scrubberWrap}>
              <SliderPrimitive.Root
                className={styles.scrubberRoot}
                min={0}
                max={duration || 1}
                step={0.01}
                value={[scrubberValue]}
                onPointerDown={handleScrubStart}
                onValueChange={handleScrubChange}
                onValueCommit={handleScrubCommit}
                aria-label="Playback position"
                aria-valuetext={`${formatTime(scrubberValue)} of ${formatTime(duration)}`}
              >
                <SliderPrimitive.Track className={styles.scrubberTrack}>
                  <SliderPrimitive.Range className={styles.scrubberRange} />
                </SliderPrimitive.Track>
                <SliderPrimitive.Thumb className={styles.scrubberThumb} />
              </SliderPrimitive.Root>
            </div>

            <span className={styles.time} aria-live="off">
              {formatTime(scrubberValue)} / {formatTime(duration)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
