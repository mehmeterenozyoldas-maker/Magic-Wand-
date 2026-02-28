import React, { useEffect, useRef, useState } from 'react';
import { HandData } from '../types';

// Declare global types for the CDN script
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

export const useHandTracking = (videoRef: React.RefObject<HTMLVideoElement>, enabled: boolean) => {
  const [isReady, setIsReady] = useState(false);
  const [trackingType, setTrackingType] = useState<'camera' | 'mouse'>('camera');
  
  const handDataRef = useRef<HandData>({
    x: 0.5,
    y: 0.5,
    z: 0,
    isPinching: false,
    isOpenPalm: false,
    detected: false
  });

  useEffect(() => {
    // Prevent running if not enabled (e.g. on landing page)
    if (!enabled) return;

    let isActive = true;
    let frameId: number;
    let hands: any = null;

    // Mouse Fallback Logic
    const enableMouseControl = () => {
        if (!isActive) return;
        console.log("Activating Mouse Fallback Mode");
        setTrackingType('mouse');
        setIsReady(true);

        const onMove = (e: MouseEvent | TouchEvent) => {
            let cx, cy;
            if ('touches' in e) {
                cx = e.touches[0].clientX;
                cy = e.touches[0].clientY;
            } else {
                cx = (e as MouseEvent).clientX;
                cy = (e as MouseEvent).clientY;
            }
            // Normalize to 0..1
            handDataRef.current.x = cx / window.innerWidth;
            handDataRef.current.y = cy / window.innerHeight;
            handDataRef.current.detected = true;
            handDataRef.current.z = 0;
        };

        const onDown = () => { handDataRef.current.isPinching = true; };
        const onUp = () => { 
            handDataRef.current.isPinching = false;
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mousedown', onDown);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove);
        window.addEventListener('touchstart', onDown);
        window.addEventListener('touchend', onUp);

        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mousedown', onDown);
            window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchstart', onDown);
            window.removeEventListener('touchend', onUp);
        };
    };

    const init = async () => {
      // Setup Timeout: If not ready in 3.5s, force mouse mode
      const fallbackTimeout = setTimeout(() => {
          if (!isReady && isActive) {
              console.warn("Camera/MediaPipe took too long. Falling back to mouse.");
              enableMouseControl();
          }
      }, 3500);

      // 1. Poll for MediaPipe script
      let attempts = 0;
      while (!window.Hands && attempts < 50) { // Wait up to 5 seconds
        if (!isActive) return;
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.Hands) {
        // If script totally failed to load
        if (isActive) {
            clearTimeout(fallbackTimeout);
            enableMouseControl();
        }
        return;
      }

      try {
        // Double check videoRef exists before starting
        if (!videoRef.current) {
             throw new Error("No video ref");
        }

        hands = new window.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        hands.onResults((results: any) => {
          if (!isActive) return;
          const lms = results?.multiHandLandmarks?.[0];
          if (lms) {
            const tip = lms[8];
            const thumb = lms[4];
            
            // Update ref directly
            handDataRef.current.x = 1.0 - tip.x;
            handDataRef.current.y = tip.y;
            handDataRef.current.z = tip.z || 0;

            const dx = thumb.x - tip.x;
            const dy = thumb.y - tip.y;
            handDataRef.current.isPinching = Math.sqrt(dx*dx + dy*dy) < 0.05;

            // Simplified Open Palm Check
            const isTipHigher = (t: number, p: number) => lms[t].y < lms[p].y - 0.02;
            const fingersOpen = 
              (isTipHigher(8,6) ? 1 : 0) + 
              (isTipHigher(12,10) ? 1 : 0) + 
              (isTipHigher(16,14) ? 1 : 0) + 
              (isTipHigher(20,18) ? 1 : 0);
            
            handDataRef.current.isOpenPalm = fingersOpen >= 3 && !handDataRef.current.isPinching;
            handDataRef.current.detected = true;
          } else {
            handDataRef.current.detected = false;
          }
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        
        if (!isActive) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Clear fallback timeout as we succeeded
        clearTimeout(fallbackTimeout);
        setTrackingType('camera');
        setIsReady(true);

        const processFrame = async () => {
          if (!isActive) return;
          if (videoRef.current && videoRef.current.readyState >= 2) {
             try { await hands.send({ image: videoRef.current }); } catch (e) {}
          }
          frameId = requestAnimationFrame(processFrame);
        };
        processFrame();

      } catch (err) {
        console.error("Camera Init Failed:", err);
        if (isActive) {
            clearTimeout(fallbackTimeout);
            enableMouseControl();
        }
      }
    };

    init();

    return () => {
      isActive = false;
      cancelAnimationFrame(frameId);
      if (hands) hands.close();
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [videoRef, enabled]); // Dependency on enabled ensures we init when Start is clicked

  return { isReady, handDataRef, trackingType };
};