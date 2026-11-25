import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { ValleyAudioEngine } from './valley/audio';
import { ValleyEngine } from './valley/ValleyEngine';
import { StudioDrawer, type StudioSection } from './components/StudioDrawer';

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const valleyMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ValleyEngine | null>(null);
  const audioRef = useRef<ValleyAudioEngine | null>(null);

  const [engineProgress, setEngineProgress] = useState(0);
  const [engineReady, setEngineReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [introShown, setIntroShown] = useState(false);
  const [soundPressed, setSoundPressed] = useState(false);
  const [activeSection, setActiveSection] = useState<StudioSection>(null);

  const loadProgress =
    engineReady && videoReady
      ? 100
      : Math.min(99, Math.round(engineProgress * 0.75 + (videoReady ? 25 : 0)));
  const isLoaded = engineReady && videoReady;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const markReady = () => setVideoReady(true);
    if (video.readyState >= 2) {
      markReady();
    }
    video.addEventListener('loadeddata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('error', markReady);
    void video.play().catch(() => {
      // Autoplay fallback handled when user interacts
    });

    const fallbackTimer = window.setTimeout(markReady, 2400);

    return () => {
      window.clearTimeout(fallbackTimer);
      video.removeEventListener('loadeddata', markReady);
      video.removeEventListener('canplay', markReady);
      video.removeEventListener('error', markReady);
    };
  }, []);

  useEffect(() => {
    const container = valleyMountRef.current;
    if (!container) return;

    const audio = new ValleyAudioEngine();
    audio.initAudio();
    audioRef.current = audio;

    const engine = new ValleyEngine({
      container,
      audio,
      onProgress: (percent) => {
        setEngineProgress(percent);
      },
      onLoaded: () => {
        setEngineProgress(100);
        setEngineReady(true);
      },
      onIntroDone: () => {
        setIntroShown(true);
      },
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      audio.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
  }, []);

  const handleToggleSound = () => {
    const nextEnabled = !soundPressed;
    setSoundPressed(nextEnabled);
    const video = videoRef.current;
    if (video) {
      video.muted = !nextEnabled;
      video.volume = activeSection ? 0.25 : 0.85;
      if (nextEnabled) {
        void video.play().catch(() => {});
      }
    }
  };

  const handleGoEnter = () => {
    engineRef.current?.startHoverTransition();
    if (videoRef.current) {
      videoRef.current.volume = 0.25;
    }
  };

  const handleGoLeave = () => {
    if (!activeSection) {
      engineRef.current?.stopHoverTransition();
      if (videoRef.current) {
        videoRef.current.volume = 0.85;
      }
    }
  };

  const openSection = useCallback((section: StudioSection) => (e: MouseEvent) => {
    e.preventDefault();
    setActiveSection(section);
    engineRef.current?.startHoverTransition();
    if (videoRef.current) {
      videoRef.current.volume = 0.25;
    }
  }, []);

  const closeSection = useCallback(() => {
    setActiveSection(null);
    engineRef.current?.stopHoverTransition();
    if (videoRef.current) {
      videoRef.current.volume = 0.85;
    }
  }, []);

  const navigateSection = useCallback((next: StudioSection) => {
    setActiveSection(next);
    if (next) {
      engineRef.current?.startHoverTransition();
      if (videoRef.current) {
        videoRef.current.volume = 0.25;
      }
    } else {
      engineRef.current?.stopHoverTransition();
      if (videoRef.current) {
        videoRef.current.volume = 0.85;
      }
    }
  }, []);

  return (
    <>
      <div className="bg-video-wrap" aria-hidden="true">
        <video
          ref={videoRef}
          id="bg-video"
          className="bg-video"
          src="/assets/aistudio/Video-62979_fab369a5.mp4"
          autoPlay
          loop
          muted={!soundPressed}
          playsInline
          preload="auto"
          data-testid="background-video"
        />
        <div className="bg-video-scrim" />
      </div>

      <div id="valley" ref={valleyMountRef} aria-hidden="true" data-testid="valley-root">
        <div className="js-canvas-container" />
      </div>

      <div
        className={`ui${introShown ? ' on' : ''}`}
        id="ui"
        data-state={introShown ? 'ready' : 'loading'}
      >
        <header className="valley-header">
          <a
            className="logo"
            href="#top"
            aria-label="Fernhollow"
            onClick={(e) => {
              e.preventDefault();
              closeSection();
            }}
          >
            Fernhollow
          </a>
          <nav className="valley-nav" aria-label="Main">
            <a href="#work" onClick={openSection('work')}>
              Work
            </a>
            <a href="#about" onClick={openSection('about')}>
              About
            </a>
            <a href="#journal" onClick={openSection('journal')}>
              Journal
            </a>
            <a className="pill" href="#contact" onClick={openSection('contact')}>
              Let’s talk
            </a>
          </nav>
        </header>

        <section className="hero">
          <h1>Grown, not built.</h1>
          <p className="cap">
            Rooted in nature.
            <br />
            Built for what’s next.
          </p>
          <a
            className="go"
            href="#work"
            id="go"
            aria-label="See our work"
            onPointerEnter={handleGoEnter}
            onPointerLeave={handleGoLeave}
            onFocus={handleGoEnter}
            onBlur={handleGoLeave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setActiveSection('work');
                engineRef.current?.startHoverTransition();
                if (videoRef.current) {
                  videoRef.current.volume = 0.25;
                }
              }
            }}
            onClick={openSection('work')}
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </a>
        </section>

        <div className="corner">
          <span>Scroll to wander</span>
          <i />
          <button
            type="button"
            className="sound"
            id="sound"
            aria-pressed={soundPressed}
            aria-label="Ambient sound"
            onClick={handleToggleSound}
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5Z" />
              <path className="w" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
              <path className="x" d="m16 10 4 4m0-4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`loader${isLoaded ? ' gone' : ''}`}
        id="loader"
        data-progress={loadProgress}
        aria-hidden={isLoaded}
        role={isLoaded ? undefined : 'status'}
        aria-label={isLoaded ? undefined : `Loading ${loadProgress}%`}
      >
        <div className="loader-inner">
          <span className="loader-dot" />
          <span className="loader-percent" aria-live="polite">
            {loadProgress}%
          </span>
        </div>
      </div>

      <StudioDrawer section={activeSection} onClose={closeSection} onNavigate={navigateSection} />
    </>
  );
}
