import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { HandData, VFXPreset, VFXEngineType } from '../types';

interface VFXCanvasProps {
  handDataRef: React.MutableRefObject<HandData>;
  preset: VFXPreset;
  mirror: boolean;
  onStatsUpdate: (stats: string) => void;
  triggerClear: boolean;
}

// --- SHADER KERNELS ---

const COMMON_UNIFORMS = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uPointer, uVel, uShockCenter, uRes;
  uniform float uEnergy, uTime, uFade, uBrushR, uStretch, uWarp, uCurl, uDiff, uHue, uHueRange, uClear, uShockT;
  
  vec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx, clamp(p-K.xxx,0.,1.), c.y); }
  float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
  }
  float fbm(vec2 p){ float s=0., a=0.5; for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.02; a*=0.5; } return s; }
  float gauss(vec2 d, float k){ return exp(-dot(d,d)*k); }
`;

const SHADER_FLUID = `
  ${COMMON_UNIFORMS}
  
  vec2 curl(vec2 p){
    float e=0.005;
    float n1=fbm(p+vec2(0,e)), n2=fbm(p-vec2(0,e));
    float n3=fbm(p+vec2(e,0)), n4=fbm(p-vec2(e,0));
    return vec2(n1-n2, -(n3-n4)) / (2.*e);
  }

  void main(){
    vec2 uv = vUv;
    vec2 asp = vec2(uRes.x/uRes.y, 1.0);
    vec2 p = uv * vec2(3.0) + vec2(0., uTime*0.05);
    
    // Advection / Curl
    vec2 w = (vec2(fbm(p), fbm(p+4.5)) - 0.5) * uWarp * 2.0;
    vec2 c = curl(p + w);
    vec2 adv = c * uCurl * (1.0 + uEnergy);
    
    vec3 prev = texture2D(uPrev, uv + adv * 0.01).rgb;

    // Blur diffusion
    vec2 tx = 1.0/uRes;
    vec3 blur = (
      texture2D(uPrev, uv+adv*0.01 + tx*vec2(1,0)).rgb +
      texture2D(uPrev, uv+adv*0.01 - tx*vec2(1,0)).rgb +
      texture2D(uPrev, uv+adv*0.01 + tx*vec2(0,1)).rgb +
      texture2D(uPrev, uv+adv*0.01 - tx*vec2(0,1)).rgb
    ) * 0.25;
    prev = mix(prev, blur, uDiff);
    prev *= uFade * mix(1.0, 0.0, uClear);

    // Brush
    vec2 d = (uv - uPointer) * asp;
    float r = uBrushR * (0.8 + uEnergy);
    float g = gauss(d / r, 1.0);
    
    float h = mod(uHue + uEnergy*30.0 + sin(uTime)*10.0, 360.0);
    vec3 color = hsv2rgb(vec3(h/360.0, 0.6, 1.0));
    vec3 source = color * g * (0.4 + uEnergy*1.5);
    
    // Shockwave
    float shock = 0.0;
    if (uShockT < 2.0) {
       float dist = length((uv - uShockCenter)*asp);
       float radius = uShockT * 0.4;
       float thickness = 0.05;
       shock = smoothstep(radius, radius-thickness, dist) * smoothstep(radius-thickness*2.0, radius-thickness, dist);
       shock *= (1.0 - uShockT/2.0) * 2.0;
    }

    gl_FragColor = vec4(clamp(prev + source + vec3(shock), 0.0, 5.0), 1.0);
  }
`;

const SHADER_STARDUST = `
  ${COMMON_UNIFORMS}

  void main(){
    vec2 uv = vUv;
    vec2 asp = vec2(uRes.x/uRes.y, 1.0);
    
    // Coordinate shifting for "Sparkle" drift
    vec2 shift = (vec2(vnoise(uv*10. + uTime), vnoise(uv*10. + uTime + 100.)) - 0.5) * 0.005;
    // High drag on previous frame
    vec3 prev = texture2D(uPrev, uv + shift).rgb;
    prev *= uFade * 0.95; // Decay faster than fluid

    // Particle Source
    vec2 d = (uv - uPointer) * asp;
    // Sharper brush
    float g = 1.0 - smoothstep(0.0, uBrushR * (1.0+uEnergy), length(d));
    
    // Glitter Noise
    float glitter = step(0.98, hash(uv * uTime));
    
    float h = mod(uHue + uEnergy * 50.0 + length(d)*100.0, 360.0);
    vec3 color = hsv2rgb(vec3(h/360.0, 0.4, 1.0));
    
    vec3 source = color * g * (glitter + 0.2) * (1.0 + uEnergy*2.0);

    // Shockwave as a void
    if (uShockT < 2.0) {
       float dist = length((uv - uShockCenter)*asp);
       float radius = uShockT * 0.5;
       if(abs(dist - radius) < 0.05) prev *= 0.0; // Clear trails
    }

    gl_FragColor = vec4(prev + source, 1.0);
  }
`;

const SHADER_CYBER = `
  ${COMMON_UNIFORMS}

  void main(){
    vec2 uv = vUv;
    vec2 asp = vec2(uRes.x/uRes.y, 1.0);

    // Grid Deformation
    vec2 d = (uv - uPointer) * asp;
    float dist = length(d);
    
    // Warp UV based on hand
    vec2 warpedUv = uv - (normalize(d) * smoothstep(0.5, 0.0, dist) * 0.02 * (1.0+uEnergy*2.0));
    
    // Feedback with slight zoom to create "Tunnel" effect
    vec3 prev = texture2D(uPrev, (warpedUv - 0.5) * 0.995 + 0.5).rgb;
    prev *= uFade;

    // Grid Gen
    vec2 gridUV = warpedUv * 30.0;
    float gridLine = step(0.9, fract(gridUV.x)) + step(0.9, fract(gridUV.y));
    
    float h = mod(uHue + (uv.y * 50.0) + (uTime * 20.0), 360.0);
    vec3 gridColor = hsv2rgb(vec3(h/360.0, 0.8, 1.0)) * gridLine * 0.2;
    
    // Active Brush
    float brush = 1.0 - smoothstep(0.0, uBrushR, dist);
    vec3 brushColor = vec3(1.0) * brush * (1.0 + uEnergy);

    // Shockwave distortion
    if (uShockT < 2.0) {
       float sDist = length((uv - uShockCenter)*asp);
       float wave = sin((sDist - uShockT * 0.5) * 50.0);
       if(sDist < uShockT * 0.5 && sDist > uShockT * 0.5 - 0.2) {
          gridColor += vec3(wave) * 2.0;
       }
    }

    gl_FragColor = vec4(prev + gridColor + brushColor, 1.0);
  }
`;

export const VFXCanvas: React.FC<VFXCanvasProps> = ({ 
  handDataRef, 
  preset, 
  mirror,
  onStatsUpdate,
  triggerClear 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const presetRef = useRef(preset);
  
  // Track current engine to detect changes
  const activeEngineRef = useRef<VFXEngineType>(preset.engine);

  useEffect(() => {
    presetRef.current = preset;
    
    // If engine changed, trigger a recompile
    if (refs.current.simMat && activeEngineRef.current !== preset.engine) {
       activeEngineRef.current = preset.engine;
       
       let newFrag = SHADER_FLUID;
       if (preset.engine === 'STARDUST') newFrag = SHADER_STARDUST;
       if (preset.engine === 'CYBER') newFrag = SHADER_CYBER;

       refs.current.simMat.fragmentShader = newFrag;
       refs.current.simMat.needsUpdate = true;
       
       // Reset buffer on engine switch for clean look
       if (refs.current.renderer && refs.current.rtA) {
         refs.current.renderer.setRenderTarget(refs.current.rtA);
         refs.current.renderer.clearColor();
         refs.current.renderer.setRenderTarget(null);
       }
    }

  }, [preset]);
  
  const simState = useRef({
    energy: 0.5, 
    pointerSmooth: new THREE.Vector3(0.5, 0.5, 0),
    pointerPrev: new THREE.Vector2(0.5, 0.5),
    vel: new THREE.Vector2(0, 0),
    clearing: false,
    clearT: 0,
    shockT: 999,
    shockCenter: new THREE.Vector2(0.5, 0.5),
    lastTime: 0
  });

  const refs = useRef<{
    simMat?: THREE.ShaderMaterial;
    postMat?: THREE.ShaderMaterial;
    bloomPass?: UnrealBloomPass;
    triggerClearPrev?: boolean;
    composer?: EffectComposer;
    renderer?: THREE.WebGLRenderer;
    rtA?: THREE.WebGLRenderTarget;
    rtB?: THREE.WebGLRenderTarget;
  }>({});

  useEffect(() => {
    if (triggerClear !== refs.current.triggerClearPrev) {
        if (triggerClear) {
             const s = simState.current;
             if (!s.clearing) {
                s.clearing = true;
                s.clearT = 0;
                s.shockT = 0;
                s.shockCenter.copy(s.pointerSmooth).setZ(0); 
             }
        }
        refs.current.triggerClearPrev = triggerClear;
    }
  }, [triggerClear]);

  useEffect(() => {
    const { simMat, bloomPass, postMat } = refs.current;
    if (!simMat || !bloomPass || !postMat) return;

    simMat.uniforms.uFade.value = preset.fade;
    simMat.uniforms.uBrushR.value = preset.brushR;
    simMat.uniforms.uStretch.value = preset.stretch;
    simMat.uniforms.uWarp.value = preset.warp;
    simMat.uniforms.uCurl.value = preset.curl;
    simMat.uniforms.uDiff.value = preset.diff;
    simMat.uniforms.uHue.value = preset.hue;
    simMat.uniforms.uHueRange.value = preset.hueRange;

    bloomPass.threshold = preset.bloomT;
    bloomPass.radius = preset.bloomR; 
    
    postMat.uniforms.uAber.value = preset.ab;
    postMat.uniforms.uRadBlur.value = preset.rb;
    postMat.uniforms.uScan.value = preset.scan;
    postMat.uniforms.uGrain.value = preset.grain;
  }, [preset]);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const renderer = new THREE.WebGLRenderer({ 
      powerPreference: "high-performance",
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    refs.current.renderer = renderer;

    const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    // --- Render Targets ---
    const simSize = Math.max(512, Math.min(1280, Math.floor(Math.min(width, height) * 1.0)));
    const rtParams = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false
    };
    let rtA = new THREE.WebGLRenderTarget(simSize, simSize, rtParams);
    let rtB = new THREE.WebGLRenderTarget(simSize, simSize, rtParams);

    // Clear targets
    renderer.setRenderTarget(rtA); renderer.clearColor();
    renderer.setRenderTarget(rtB); renderer.clearColor();
    renderer.setRenderTarget(null);

    // --- Initial Shader Selection ---
    let initialFrag = SHADER_FLUID;
    if (preset.engine === 'STARDUST') initialFrag = SHADER_STARDUST;
    if (preset.engine === 'CYBER') initialFrag = SHADER_CYBER;

    const simMat = new THREE.ShaderMaterial({
      uniforms: {
        uPrev: { value: rtA.texture },
        uPointer: { value: new THREE.Vector2(0.5, 0.5) },
        uVel: { value: new THREE.Vector2(0, 0) },
        uEnergy: { value: 0.5 },
        uTime: { value: 0.0 },
        uFade: { value: preset.fade },
        uBrushR: { value: preset.brushR },
        uStretch: { value: preset.stretch },
        uWarp: { value: preset.warp },
        uCurl: { value: preset.curl },
        uDiff: { value: preset.diff },
        uHue: { value: preset.hue },
        uHueRange: { value: preset.hueRange },
        uClear: { value: 0.0 },
        uShockT: { value: 999.0 },
        uShockCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uRes: { value: new THREE.Vector2(simSize, simSize) }
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: initialFrag
    });
    refs.current.simMat = simMat;

    const simScene = new THREE.Scene();
    simScene.add(new THREE.Mesh(geometry, simMat));

    // --- Display Material ---
    const dispMat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: null } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        precision highp float; varying vec2 vUv; uniform sampler2D uTex;
        void main(){
          vec3 col = texture2D(uTex, vUv).rgb;
          col = col / (1.0 + col); // Tonemap
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    const dispScene = new THREE.Scene();
    dispScene.add(new THREE.Mesh(geometry, dispMat));

    // --- Post Processing ---
    const composer = new EffectComposer(renderer);
    refs.current.composer = composer;
    composer.addPass(new RenderPass(dispScene, orthoCam));

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), preset.bloomS, preset.bloomR, preset.bloomT);
    composer.addPass(bloomPass);
    refs.current.bloomPass = bloomPass;

    const postMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0. },
        uAber: { value: preset.ab },
        uRadBlur: { value: preset.rb },
        uScan: { value: preset.scan },
        uGrain: { value: preset.grain }
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse;
        uniform float uTime, uAber, uRadBlur, uScan, uGrain;
        float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }

        void main(){
           vec2 uv = vUv;
           vec2 dist = uv - 0.5;
           vec3 col;
           col.r = texture2D(tDiffuse, uv + dist * uAber).r;
           col.g = texture2D(tDiffuse, uv).g;
           col.b = texture2D(tDiffuse, uv - dist * uAber).b;

           float scan = sin(uv.y * 800.0 + uTime * 5.0) * 0.04;
           col -= scan * uScan;
           float noise = (rand(uv + uTime) - 0.5) * uGrain;
           col += noise;
           gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    composer.addPass(new ShaderPass(postMat));
    refs.current.postMat = postMat;

    const handleResize = () => {
        if (!containerRef.current || !refs.current.renderer || !refs.current.composer) return;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        refs.current.renderer.setSize(w, h);
        refs.current.composer.setSize(w, h);
        refs.current.bloomPass!.resolution.set(w, h);
    };
    window.addEventListener('resize', handleResize);

    let openHoldStart = 0;
    let animationId = 0;

    const animate = (now: number) => {
      animationId = requestAnimationFrame(animate);
      const s = simState.current;
      const hand = handDataRef.current;
      const currentPreset = presetRef.current;
      const t = now * 0.001;
      
      const dt = Math.min(0.05, (now - s.lastTime) * 0.001);
      s.lastTime = now;

      let tx = s.pointerSmooth.x;
      let ty = s.pointerSmooth.y;
      let tz = s.pointerSmooth.z;
      
      if (hand.detected) {
        tx = hand.x;
        ty = hand.y;
        tz = hand.z;
      } else {
        tx = 0.5 + Math.sin(t * 0.5) * 0.2;
        ty = 0.5 + Math.cos(t * 0.3) * 0.2;
      }

      s.pointerSmooth.lerp(new THREE.Vector3(tx, ty, tz), 0.1);
      s.vel.set(s.pointerSmooth.x - s.pointerPrev.x, s.pointerSmooth.y - s.pointerPrev.y);
      s.pointerPrev.set(s.pointerSmooth.x, s.pointerSmooth.y);

      let targetEnergy = 0.0;
      if (hand.detected) {
          const speedE = Math.min(1.0, s.vel.length() * 20.0);
          const pinchE = hand.isPinching ? 0.6 : 0.0;
          targetEnergy = Math.min(1.0, speedE + pinchE + 0.2);
      } else {
          targetEnergy = 0.1;
      }
      s.energy += (targetEnergy - s.energy) * 0.1;

      if (hand.detected && hand.isOpenPalm) {
        if (openHoldStart === 0) openHoldStart = now;
        if (now - openHoldStart > 950 && !s.clearing) {
          s.clearing = true;
          s.clearT = 0;
          s.shockT = 0;
          s.shockCenter.copy(s.pointerSmooth).setZ(0);
        }
      } else {
        openHoldStart = 0;
      }

      if (s.clearing) {
        s.clearT += 0.05;
        if (s.clearT >= 1.0) s.clearing = false;
      }
      s.shockT += dt * 5.0;

      if (refs.current.bloomPass) {
          const boost = s.energy * 0.8;
          refs.current.bloomPass.strength = currentPreset.bloomS * (1.0 + boost);
          refs.current.bloomPass.radius = currentPreset.bloomR * (1.0 + boost * 0.3);
      }

      simMat.uniforms.uPrev.value = rtA.texture;
      simMat.uniforms.uPointer.value.set(s.pointerSmooth.x, s.pointerSmooth.y);
      simMat.uniforms.uVel.value.copy(s.vel);
      simMat.uniforms.uEnergy.value = s.energy;
      simMat.uniforms.uTime.value = t;
      simMat.uniforms.uClear.value = s.clearing ? s.clearT : 0.0;
      simMat.uniforms.uShockT.value = s.shockT;
      simMat.uniforms.uShockCenter.value.copy(s.shockCenter);
      
      dispMat.uniforms.uTex.value = rtA.texture;
      postMat.uniforms.uTime.value = t;

      renderer.setRenderTarget(rtB);
      renderer.render(simScene, orthoCam);
      renderer.setRenderTarget(null);

      const temp = rtA; rtA = rtB; rtB = temp;
      composer.render();

      if (Math.floor(now) % 15 === 0) {
         onStatsUpdate(hand.detected ? `Tracking Active | Energy: ${(s.energy*100).toFixed(0)}%` : "Searching for Hand...");
      }
    };

    animate(performance.now());

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      rtA.dispose();
      rtB.dispose();
      geometry.dispose();
      simMat.dispose();
      dispMat.dispose();
      postMat.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{zIndex: -1}} />;
};