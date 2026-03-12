import { useRef, useState, useEffect, useCallback } from "react"
import LiquidGlassOriginal from "../../../liquid-original"
import LiquidGlassOptimized from "../../../liquid-optimized"
import Link from "next/link"

function useFPS() {
  const [fps, setFps] = useState(0)
  const frames = useRef(0)
  const lastTime = useRef(performance.now())

  useEffect(() => {
    let id: number
    const tick = () => {
      frames.current++
      const now = performance.now()
      if (now - lastTime.current >= 1000) {
        setFps(frames.current)
        frames.current = 0
        lastTime.current = now
      }
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])

  return fps
}

function useFrameTiming() {
  const [avgFrameTime, setAvgFrameTime] = useState(0)
  const frameTimes = useRef<number[]>([])
  const lastFrame = useRef(performance.now())

  useEffect(() => {
    let id: number
    const tick = () => {
      const now = performance.now()
      const delta = now - lastFrame.current
      lastFrame.current = now
      frameTimes.current.push(delta)
      if (frameTimes.current.length > 60) frameTimes.current.shift()

      const avg = frameTimes.current.reduce((a, b) => a + b, 0) / frameTimes.current.length
      setAvgFrameTime(avg)

      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [])

  return avgFrameTime
}

const GlassContent = () => (
  <div style={{ width: "200px", padding: "2px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          background: "linear-gradient(135deg, rgba(139,92,246,0.6), rgba(59,130,246,0.6))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "16px",
          fontWeight: 700,
          color: "white",
          fontFamily: "system-ui",
        }}
      >
        LG
      </div>
      <div>
        <p style={{ fontWeight: 600, fontSize: "14px", color: "white", fontFamily: "system-ui", margin: 0 }}>
          Glass Card
        </p>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", fontFamily: "system-ui", margin: "2px 0 0" }}>
          Move mouse to test
        </p>
      </div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {["Refraction", "Blur", "Chromatic"].map((label) => (
        <div
          key={label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "12px",
            fontFamily: "system-ui",
          }}
        >
          <span style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
          <span style={{ color: "rgba(255,255,255,0.85)" }}>Active</span>
        </div>
      ))}
    </div>
  </div>
)

function StressTestRunner({
  leftRef,
  rightRef,
  running,
}: {
  leftRef: React.RefObject<HTMLDivElement | null>
  rightRef: React.RefObject<HTMLDivElement | null>
  running: boolean
}) {
  useEffect(() => {
    if (!running) return

    let frame = 0
    let id: number

    const tick = () => {
      frame++
      const t = frame * 0.05
      const containers = [leftRef.current, rightRef.current]

      for (const container of containers) {
        if (!container) continue
        const rect = container.getBoundingClientRect()

        // Generate circular mouse movement pattern
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const radius = Math.min(rect.width, rect.height) * 0.35
        const x = cx + Math.cos(t) * radius + Math.sin(t * 2.7) * radius * 0.3
        const y = cy + Math.sin(t) * radius + Math.cos(t * 1.3) * radius * 0.3

        container.dispatchEvent(
          new MouseEvent("mousemove", {
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        )
      }

      id = requestAnimationFrame(tick)
    }

    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [running, leftRef, rightRef])

  return null
}

export default function Benchmark() {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const fps = useFPS()
  const avgFrameTime = useFrameTiming()

  const [stressRunning, setStressRunning] = useState(false)
  const [origRenders, setOrigRenders] = useState(0)
  const [optRenders, setOptRenders] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const startTime = useRef<number | null>(null)

  const handleOrigRender = useCallback((count: number) => setOrigRenders(count), [])
  const handleOptRender = useCallback((count: number) => setOptRenders(count), [])

  // Elapsed timer during stress test
  useEffect(() => {
    if (!stressRunning) {
      startTime.current = null
      return
    }
    startTime.current = Date.now()
    const interval = setInterval(() => {
      if (startTime.current) {
        setElapsed(Math.floor((Date.now() - startTime.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [stressRunning])

  const resetCounters = () => {
    setOrigRenders(0)
    setOptRenders(0)
    setElapsed(0)
    setStressRunning(false)
  }

  const fpsColor = fps >= 55 ? "#4ade80" : fps >= 30 ? "#fbbf24" : "#f87171"
  const renderRatio = origRenders > 0 && optRenders > 0 ? (origRenders / optRenders).toFixed(1) : "—"

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "white",
        fontFamily: "'SF Pro Text', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 32px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link
            href="/"
            style={{
              color: "rgba(255,255,255,0.5)",
              textDecoration: "none",
              fontSize: "14px",
              transition: "color 0.2s",
            }}
          >
            ← Back
          </Link>
          <h1 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            Performance Benchmark
          </h1>
        </div>

        {/* Global stats */}
        <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>FPS</div>
            <div style={{ fontSize: "24px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: fpsColor }}>{fps}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Frame Time</div>
            <div style={{ fontSize: "24px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.9)" }}>
              {avgFrameTime.toFixed(1)}<span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>ms</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          padding: "16px 32px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          gap: "12px",
          alignItems: "center",
        }}
      >
        <button
          onClick={() => setStressRunning(!stressRunning)}
          style={{
            padding: "8px 20px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "13px",
            fontFamily: "inherit",
            transition: "all 0.15s ease",
            background: stressRunning
              ? "linear-gradient(135deg, #ef4444, #dc2626)"
              : "linear-gradient(135deg, #3b82f6, #2563eb)",
            color: "white",
          }}
        >
          {stressRunning ? "Stop Stress Test" : "Start Stress Test"}
        </button>
        <button
          onClick={resetCounters}
          style={{
            padding: "8px 20px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent",
            color: "rgba(255,255,255,0.7)",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "13px",
            fontFamily: "inherit",
            transition: "all 0.15s ease",
          }}
        >
          Reset
        </button>
        {stressRunning && (
          <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}>
            Running for {elapsed}s
          </span>
        )}

        {/* Render comparison */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "24px", alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Render Ratio
            </div>
            <div style={{ fontSize: "18px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#fbbf24" }}>
              {renderRatio}x
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", height: "calc(100vh - 130px)" }}>
        {/* Left: Original */}
        <div
          style={{
            borderRight: "1px solid rgba(255,255,255,0.08)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Label */}
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.3)",
                fontSize: "13px",
                fontWeight: 600,
                color: "#f87171",
              }}
            >
              Original
            </div>
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontSize: "12px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.5)" }}>Renders: </span>
              <span style={{ color: "#f87171", fontWeight: 600 }}>{origRenders.toLocaleString()}</span>
            </div>
          </div>

          {/* Background */}
          <div
            ref={leftRef}
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: "400px",
                height: "400px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)",
                top: "20%",
                left: "30%",
                filter: "blur(40px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                width: "300px",
                height: "300px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)",
                bottom: "10%",
                right: "10%",
                filter: "blur(30px)",
              }}
            />

            <LiquidGlassOriginal
              displacementScale={90}
              blurAmount={0.4}
              saturation={150}
              aberrationIntensity={3}
              elasticity={0.15}
              cornerRadius={24}
              mouseContainer={leftRef}
              onRenderCount={handleOrigRender}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
              }}
            >
              <GlassContent />
            </LiquidGlassOriginal>
          </div>
        </div>

        {/* Right: Optimized */}
        <div
          style={{
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Label */}
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              zIndex: 20,
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                background: "rgba(34,197,94,0.15)",
                border: "1px solid rgba(34,197,94,0.3)",
                fontSize: "13px",
                fontWeight: 600,
                color: "#4ade80",
              }}
            >
              Optimized
            </div>
            <div
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.1)",
                fontSize: "12px",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.5)" }}>Renders: </span>
              <span style={{ color: "#4ade80", fontWeight: 600 }}>{optRenders.toLocaleString()}</span>
            </div>
          </div>

          {/* Background */}
          <div
            ref={rightRef}
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: "400px",
                height: "400px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)",
                top: "20%",
                left: "30%",
                filter: "blur(40px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                width: "300px",
                height: "300px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(236,72,153,0.2) 0%, transparent 70%)",
                bottom: "10%",
                right: "10%",
                filter: "blur(30px)",
              }}
            />

            <LiquidGlassOptimized
              displacementScale={90}
              blurAmount={0.4}
              saturation={150}
              aberrationIntensity={3}
              elasticity={0.15}
              cornerRadius={24}
              mouseContainer={rightRef}
              onRenderCount={handleOptRender}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
              }}
            >
              <GlassContent />
            </LiquidGlassOptimized>
          </div>
        </div>
      </div>

      <StressTestRunner leftRef={leftRef} rightRef={rightRef} running={stressRunning} />

      <style jsx global>{`
        button:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
        button:active {
          transform: translateY(0);
        }
        a:hover {
          color: rgba(255,255,255,0.8) !important;
        }
      `}</style>
    </div>
  )
}
