import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';

interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

const COLOR_MAP: Record<string, ColorRGB> = {
  rss: { r: 249, g: 115, b: 22 },      // Orange (#f97316)
  podcast: { r: 168, g: 85, b: 247 },  // Purple (#a855f7)
  radio: { r: 59, g: 130, b: 246 },    // Blue (#3b82f6)
  youtube: { r: 239, g: 68, b: 68 },    // Red (#ef4444)
  webcam: { r: 16, g: 185, b: 129 },   // Green (#10b981)
  blog: { r: 234, g: 179, b: 8 },      // Yellow (#eab308)
  default: { r: 99, g: 102, b: 241 }   // Indigo (#6366f1)
};

interface AmbientWaveProps {
  className?: string;
}

export function AmbientWave({ className }: AmbientWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const location = useLocation();
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';

  // Determine active category based on current pathname
  let activeCategory = 'default';
  const path = location.pathname;
  if (path === '/' || path.startsWith('/login') || path.startsWith('/settings') || path.startsWith('/profile')) {
    activeCategory = 'rss';
  } else if (path.startsWith('/impressum') || path.startsWith('/datenschutz')) {
    activeCategory = 'rss'; // Orange wave
  } else if (path.startsWith('/rss-feeds')) {
    activeCategory = 'rss';
  } else if (path.startsWith('/podcasts')) {
    activeCategory = 'podcast';
  } else if (path.startsWith('/radio')) {
    activeCategory = 'radio';
  } else if (path.startsWith('/youtube')) {
    activeCategory = 'youtube';
  } else if (path.startsWith('/webcam')) {
    activeCategory = 'webcam';
  } else if (
    path.startsWith('/blogs') || 
    path.startsWith('/article/') || 
    path.startsWith('/p/')
  ) {
    activeCategory = 'blog';
  } else if (path.startsWith('/discover') || path.startsWith('/admin')) {
    if (path.includes('/feeds')) {
      activeCategory = 'rss';
    } else if (path.includes('/podcasts')) {
      activeCategory = 'podcast';
    } else if (path.includes('/radio')) {
      activeCategory = 'radio';
    } else if (path.includes('/youtube')) {
      activeCategory = 'youtube';
    } else if (path.includes('/webcams')) {
      activeCategory = 'webcam';
    } else if (path.includes('/blogs')) {
      activeCategory = 'blog';
    } else {
      activeCategory = 'rss'; // Default discover category is feeds
    }
  }

  const targetColor = COLOR_MAP[activeCategory] || COLOR_MAP.default;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isMobile = window.innerWidth < 768;
    let scaleFactor = isMobile ? 0.35 : 0.65;

    let realWidth = window.innerWidth;
    let realHeight = window.innerHeight;
    let width = canvas.width = Math.round(realWidth * scaleFactor);
    let height = canvas.height = Math.round(realHeight * scaleFactor);

    // Handle resizing
    const resizeObserver = new ResizeObserver(() => {
      realWidth = window.innerWidth;
      realHeight = window.innerHeight;
      isMobile = window.innerWidth < 768;
      scaleFactor = isMobile ? 0.35 : 0.65;
      width = canvas.width = Math.round(realWidth * scaleFactor);
      height = canvas.height = Math.round(realHeight * scaleFactor);
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // Color interpolation state
    const currentColor = { ...targetColor };

    // Animation phases
    let phase1 = 0;
    let phase2 = 2;
    let phase3 = 4;

    const animate = () => {
      // 1. Smoothly transition color towards target
      currentColor.r += (targetColor.r - currentColor.r) * 0.04;
      currentColor.g += (targetColor.g - currentColor.g) * 0.04;
      currentColor.b += (targetColor.b - currentColor.b) * 0.04;

      // 2. Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Increment phases for wave movement (slow and majestic)
      phase1 += 0.003;
      phase2 += 0.004;
      phase3 += 0.002;

      // Prepare gradient color string
      const colorStr = `${Math.round(currentColor.r)}, ${Math.round(currentColor.g)}, ${Math.round(currentColor.b)}`;

      // 3. Draw ambient background glow (extremely subtle, scaled)
      const glowGrad = ctx.createRadialGradient(
        width * 0.5, height * 0.5, 10 * scaleFactor,
        width * 0.5, height * 0.5, Math.max(width, height) * 0.7
      );
      if (isDark) {
        glowGrad.addColorStop(0, `rgba(${colorStr}, 0.03)`);
        glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        glowGrad.addColorStop(0, `rgba(${colorStr}, 0.02)`);
        glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // Helper to draw a single wave path across the screen
      const drawWave = (
        amp: number, 
        freq: number, 
        phase: number, 
        opacity: number, 
        verticalOffsetMultiplier: number = 0
      ) => {
        // Base vertical center (using logical coordinates)
        const logicalHeight = height / scaleFactor;
        const logicalWidth = width / scaleFactor;
        const centerY = logicalHeight * 0.48;

        const points: Array<{ x: number; y: number }> = [];
        const step = isMobile ? 8 : 10; // step in canvas coordinates

        for (let x = 0; x <= width + step; x += step) {
          const currentX = Math.min(x, width);
          const logicalX = currentX / scaleFactor;
          // Combination of sine waves to make a natural, non-repeating flow
          const sine1 = Math.sin(logicalX * freq + phase);
          const sine2 = Math.cos(logicalX * (freq * 0.5) - phase * 0.7);
          const sine3 = Math.sin(logicalX * (freq * 1.8) + phase * 1.2);
          
          const logicalY = centerY + (sine1 + sine2 * 0.4 + sine3 * 0.2) * amp + (logicalX - logicalWidth / 2) * verticalOffsetMultiplier;
          
          // Map back to canvas coordinates
          points.push({ x: currentX, y: logicalY * scaleFactor });
          if (currentX === width) break;
        }

        // Helper to draw the path with a specific width and relative opacity
        const drawPathWithWidth = (lineWidth: number, alphaMultiplier: number) => {
          ctx.beginPath();
          ctx.lineWidth = lineWidth * scaleFactor;

          // Gradient for the wave line itself, fading out at the left and right edges
          const waveGrad = ctx.createLinearGradient(0, 0, width, 0);
          waveGrad.addColorStop(0, `rgba(${colorStr}, 0)`);
          waveGrad.addColorStop(0.2, `rgba(${colorStr}, ${opacity * alphaMultiplier * 0.35})`);
          waveGrad.addColorStop(0.5, `rgba(${colorStr}, ${opacity * alphaMultiplier})`);
          waveGrad.addColorStop(0.8, `rgba(${colorStr}, ${opacity * alphaMultiplier * 0.35})`);
          waveGrad.addColorStop(1, `rgba(${colorStr}, 0)`);

          ctx.strokeStyle = waveGrad;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (points.length > 0) {
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
              ctx.lineTo(points[i].x, points[i].y);
            }
          }
          ctx.stroke();
        };

        // Draw multiple layers from thickest (most ambient) to thinnest (most distinct)
        // This generates a beautiful volumetric, smoky, glowing silk-ribbon effect
        // On mobile, we only draw 2 layers instead of 5 to save massive amount of GPU/fill-rate.
        // On desktop, we draw 3 layers instead of 5 to keep the majestic look but free up resources.
        if (isMobile) {
          drawPathWithWidth(450, 0.25);  // Broad outer glow
          drawPathWithWidth(36, 1.0);    // Core highlight
        } else {
          drawPathWithWidth(800, 0.20);  // Outer glow
          drawPathWithWidth(300, 0.60);  // Inner body
          drawPathWithWidth(36, 1.0);    // Core highlight
        }
      };

      // Draw overlapping waves with varying amplitude, frequency and opacity
      // On mobile, we draw only ONE wave (the majestic base wave) to avoid over-complicating fill-rate.
      // On desktop, we draw TWO waves instead of three.
      if (isMobile) {
        drawWave(190, 0.0012, phase1, isDark ? 0.35 : 0.26);
      } else {
        // Wave 1: Majestic base wave (thick and slow)
        drawWave(190, 0.0012, phase1, isDark ? 0.35 : 0.26);
        
        // Wave 2: Faster, secondary wave
        drawWave(140, 0.0025, -phase2, isDark ? 0.25 : 0.18, 0.01);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [targetColor, isDark, settings.showAmbientWaves]);

  if (settings.showAmbientWaves === false) {
    return null;
  }

  return (
    <canvas
      id="ambient-wave-canvas"
      ref={canvasRef}
      className={className || "absolute inset-0 w-full h-full pointer-events-none z-0 transition-opacity duration-1000"}
      style={{ 
        mixBlendMode: isDark ? 'screen' : 'multiply',
        willChange: 'transform',
        transform: 'translate3d(0, 0, 0)'
      }}
    />
  );
}
