/**
 * Hush Interactive Web Playground & Audio Engine Simulator
 * Powers the live demo on the Hush landing page.
 */

(function () {
  'use strict';

  // --- 1. Synthesized Web Audio Preview Engine ---
  let audioCtx = null;
  let masterGain = null;
  let osc1 = null;
  let osc2 = null;
  let filterNode = null;
  let isAudioPlaying = false;
  let visualizerAnimId = null;

  const audioToggleBtn = document.getElementById('demo-audio-toggle');
  const audioStatusText = document.getElementById('demo-audio-status');
  const visualizerContainer = document.getElementById('demo-visualizer');
  const visualizerBars = visualizerContainer ? visualizerContainer.querySelectorAll('.vis-bar') : [];

  function initAudioEngine() {
    if (audioCtx) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();

      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0, audioCtx.currentTime);

      filterNode = audioCtx.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(650, audioCtx.currentTime);

      // Warm ambient chord (A3 = 220Hz, E4 = 329.63Hz)
      osc1 = audioCtx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(220, audioCtx.currentTime);

      osc2 = audioCtx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(329.63, audioCtx.currentTime);

      osc1.connect(filterNode);
      osc2.connect(filterNode);
      filterNode.connect(masterGain);
      masterGain.connect(audioCtx.destination);

      osc1.start();
      osc2.start();
    } catch (e) {
      console.warn('Web Audio API not supported or autoplay blocked:', e);
    }
  }

  function toggleAudioPlayback() {
    initAudioEngine();

    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    isAudioPlaying = !isAudioPlaying;
    window.dispatchEvent(new CustomEvent('HushSoundActiveChange', { detail: { active: isAudioPlaying } }));

    if (isAudioPlaying) {
      updateSynthesizerVolume();
      if (audioToggleBtn) {
        audioToggleBtn.classList.add('is-active');
        audioToggleBtn.setAttribute('aria-pressed', 'true');
      }
      if (audioStatusText) {
        audioStatusText.textContent = 'Ambient Preview: Playing';
      }
      startVisualizer();
    } else {
      if (masterGain && audioCtx) {
        masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
      }
      if (audioToggleBtn) {
        audioToggleBtn.classList.remove('is-active');
        audioToggleBtn.setAttribute('aria-pressed', 'false');
      }
      if (audioStatusText) {
        audioStatusText.textContent = 'Ambient Preview: Muted';
      }
      stopVisualizer();
    }
  }

  function updateSynthesizerVolume() {
    if (!isAudioPlaying || !masterGain || !audioCtx) return;

    // Calculate effective volume from active Spotify slider
    const spotifySlider = document.getElementById('slider-spotify');
    const spotifyMuted = document.getElementById('row-spotify')?.classList.contains('is-muted');
    const val = spotifySlider && !spotifyMuted ? parseFloat(spotifySlider.value) / 100 : 0;

    // Gentle target gain capped at 0.25 to prevent loudness
    const targetGain = val * 0.22;
    masterGain.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.04);
  }

  function startVisualizer() {
    if (visualizerAnimId) cancelAnimationFrame(visualizerAnimId);

    function animateBars() {
      const spotifySlider = document.getElementById('slider-spotify');
      const spotifyMuted = document.getElementById('row-spotify')?.classList.contains('is-muted');
      const volPercent = spotifySlider && !spotifyMuted ? parseFloat(spotifySlider.value) : 0;
      const factor = isAudioPlaying ? volPercent / 100 : 0.08;

      visualizerBars.forEach((bar, idx) => {
        const time = Date.now() * 0.005;
        const wave = Math.sin(time + idx * 0.6) * 0.5 + 0.5;
        const barHeight = Math.max(4, Math.round(wave * 24 * factor + 3));
        bar.style.height = `${barHeight}px`;
        bar.style.opacity = isAudioPlaying && volPercent > 0 ? (0.4 + factor * 0.6).toFixed(2) : '0.2';
      });

      visualizerAnimId = requestAnimationFrame(animateBars);
    }

    animateBars();
  }

  function stopVisualizer() {
    if (visualizerAnimId) cancelAnimationFrame(visualizerAnimId);
    visualizerAnimId = null;
    visualizerBars.forEach(bar => {
      bar.style.height = '4px';
      bar.style.opacity = '0.25';
    });
  }

  if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', toggleAudioPlayback);
  }

  // --- 2. Interactive Tab Sliders & Controls ---
  const tabRows = [
    { id: 'spotify', sliderId: 'slider-spotify', valId: 'val-spotify', muteBtnId: 'mute-spotify' },
    { id: 'youtube', sliderId: 'slider-youtube', valId: 'val-youtube', muteBtnId: 'mute-youtube' },
    { id: 'whatsapp', sliderId: 'slider-whatsapp', valId: 'val-whatsapp', muteBtnId: 'mute-whatsapp' },
    { id: 'chatgpt', sliderId: 'slider-chatgpt', valId: 'val-chatgpt', muteBtnId: 'mute-chatgpt' }
  ];

  tabRows.forEach(({ id, sliderId, valId, muteBtnId }) => {
    const slider = document.getElementById(sliderId);
    const valEl = document.getElementById(valId);
    const muteBtn = document.getElementById(muteBtnId);
    const rowEl = document.getElementById(`row-${id}`);

    if (slider && valEl) {
      slider.addEventListener('input', (e) => {
        const val = e.target.value;
        valEl.textContent = `${val}%`;

        if (rowEl && rowEl.classList.contains('is-muted')) {
          rowEl.classList.remove('is-muted');
          if (muteBtn) muteBtn.classList.remove('is-muted');
        }

        if (id === 'spotify') {
          updateSynthesizerVolume();
        }
      });

      // Mouse wheel scrubbing (±5%)
      slider.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 5 : -5;
        const current = parseInt(slider.value, 10);
        const next = Math.min(100, Math.max(0, current + delta));
        slider.value = next;
        slider.dispatchEvent(new Event('input'));
      }, { passive: false });
    }

    if (muteBtn && rowEl && slider && valEl) {
      muteBtn.addEventListener('click', () => {
        const isMuted = rowEl.classList.toggle('is-muted');
        muteBtn.classList.toggle('is-muted');
        
        if (isMuted) {
          rowEl.dataset.prevVal = slider.value;
          valEl.textContent = '0%';
        } else {
          const restored = rowEl.dataset.prevVal || '80';
          slider.value = restored;
          valEl.textContent = `${restored}%`;
        }

        if (id === 'spotify') {
          updateSynthesizerVolume();
        }
      });
    }
  });

  // Group Master Volume Slider
  const groupSlider = document.getElementById('slider-group-entertainment');
  const groupVal = document.getElementById('val-group-entertainment');
  if (groupSlider && groupVal) {
    groupSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      groupVal.textContent = `${val}%`;

      // Proportional scale for child tabs
      const factor = parseInt(val, 10) / 100;
      const spotifySlider = document.getElementById('slider-spotify');
      const valSpotify = document.getElementById('val-spotify');
      if (spotifySlider && valSpotify) {
        const targetSpotify = Math.round(85 * factor);
        spotifySlider.value = targetSpotify;
        valSpotify.textContent = `${targetSpotify}%`;
      }

      const youtubeSlider = document.getElementById('slider-youtube');
      const valYoutube = document.getElementById('val-youtube');
      if (youtubeSlider && valYoutube) {
        const targetYoutube = Math.round(70 * factor);
        youtubeSlider.value = targetYoutube;
        valYoutube.textContent = `${targetYoutube}%`;
      }

      updateSynthesizerVolume();
    });
  }

  // --- 3. Interactive Focus Mode Presets ---
  const focusPresets = {
    'deep-focus': {
      spotify: 75,
      youtube: 0,
      whatsapp: 0,
      chatgpt: 0,
      label: 'Deep Focus Applied (Spotify: 75%, Background tabs muted)'
    },
    'study-lofi': {
      spotify: 0,
      youtube: 85,
      whatsapp: 0,
      chatgpt: 0,
      label: 'Study Lo-Fi Applied (YouTube Beats: 85%, Others muted)'
    },
    'meeting-mode': {
      spotify: 0,
      youtube: 0,
      whatsapp: 100,
      chatgpt: 100,
      label: 'Meeting Mode Applied (Communication: 100%, Music muted)'
    },
    'reset': {
      spotify: 85,
      youtube: 70,
      whatsapp: 100,
      chatgpt: 50,
      label: 'Default Acoustic Balance Restored'
    }
  };

  const focusNotice = document.getElementById('demo-focus-notice');
  const presetButtons = document.querySelectorAll('.focus-preset-btn');

  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.preset;
      const preset = focusPresets[mode];
      if (!preset) return;

      presetButtons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      window.dispatchEvent(new CustomEvent('HushFocusModeApplied', { detail: { mode } }));

      // Animate sliders smoothly to preset values
      setSliderValue('spotify', preset.spotify);
      setSliderValue('youtube', preset.youtube);
      setSliderValue('whatsapp', preset.whatsapp);
      setSliderValue('chatgpt', preset.chatgpt);

      if (focusNotice) {
        focusNotice.textContent = preset.label;
        focusNotice.classList.add('is-visible');
        setTimeout(() => {
          focusNotice.classList.remove('is-visible');
        }, 3200);
      }

      updateSynthesizerVolume();
    });
  });

  function setSliderValue(tabKey, targetVal) {
    const slider = document.getElementById(`slider-${tabKey}`);
    const valEl = document.getElementById(`val-${tabKey}`);
    const rowEl = document.getElementById(`row-${tabKey}`);
    const muteBtn = document.getElementById(`mute-${tabKey}`);

    if (!slider || !valEl) return;

    slider.value = targetVal;
    valEl.textContent = `${targetVal}%`;

    if (rowEl) {
      if (targetVal === 0) {
        rowEl.classList.add('is-muted');
        if (muteBtn) muteBtn.classList.add('is-muted');
      } else {
        rowEl.classList.remove('is-muted');
        if (muteBtn) muteBtn.classList.remove('is-muted');
      }
    }
  }

  // --- 4. Interactive Keyboard Shortcuts Tester ---
  document.addEventListener('keydown', (e) => {
    // Quick Mute active tab with Alt+M
    if (e.altKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      const spotifyMute = document.getElementById('mute-spotify');
      if (spotifyMute) {
        spotifyMute.click();
        showWebToast('Alt+M triggered: Toggled Spotify tab mute');
      }
    }
  });

  function showWebToast(message) {
    let toast = document.getElementById('web-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'web-toast';
      toast.className = 'web-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('is-active');
    setTimeout(() => {
      toast.classList.remove('is-active');
    }, 2800);
  }

  // --- 5. Interactive FAQ Accordion ---
  const faqHeaders = document.querySelectorAll('.faq-accordion-header');
  faqHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.faq-card');
      if (!card) return;
      const isOpen = card.classList.contains('is-open');

      // Close other cards in same grid
      document.querySelectorAll('.faq-card').forEach(c => {
        if (c !== card) c.classList.remove('is-open');
      });

      card.classList.toggle('is-open', !isOpen);
      header.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
    });
  });

  // --- 6. Interactive Architecture Step Highlights ---
  const archSteps = document.querySelectorAll('.flow-step');
  archSteps.forEach(step => {
    step.addEventListener('mouseenter', () => {
      archSteps.forEach(s => s.classList.remove('is-highlighted'));
      step.classList.add('is-highlighted');
    });
  });

})();
