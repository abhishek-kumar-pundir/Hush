(function() {
  if ((window as any).__tabsound_patched) return;
  (window as any).__tabsound_patched = true;

  let currentVolume = 1.0;
  const masterGains = new Set<GainNode>();

  const originalConnect = AudioNode.prototype.connect;
  
  // @ts-ignore
  AudioNode.prototype.connect = function(destination, outputIndex, inputIndex) {
    if (destination && destination.context && destination === destination.context.destination) {
      const ctx = destination.context as any;
      if (!ctx.__tabsound_master_gain) {
        const gain = ctx.createGain();
        gain.gain.value = currentVolume;
        originalConnect.call(gain, destination);
        ctx.__tabsound_master_gain = gain;
        masterGains.add(gain);
      }
      
      if (outputIndex !== undefined) {
         if (inputIndex !== undefined) {
            return originalConnect.call(this, ctx.__tabsound_master_gain, outputIndex, inputIndex);
         }
         return originalConnect.call(this, ctx.__tabsound_master_gain, outputIndex);
      }
      return originalConnect.call(this, ctx.__tabsound_master_gain);
    }
    
    if (outputIndex !== undefined) {
       if (inputIndex !== undefined) {
          return originalConnect.call(this, destination, outputIndex, inputIndex);
       }
       return originalConnect.call(this, destination, outputIndex);
    }
    return originalConnect.call(this, destination);
  };

  window.addEventListener('TabSoundVolumeChange', (e: any) => {
    currentVolume = e.detail.volume;
    for (const gain of masterGains) {
      if (gain.context.state !== 'closed') {
         try {
           gain.gain.setTargetAtTime(currentVolume, gain.context.currentTime, 0.05);
         } catch(e) {
           gain.gain.value = currentVolume;
         }
      } else {
         masterGains.delete(gain);
      }
    }
  });
})();
