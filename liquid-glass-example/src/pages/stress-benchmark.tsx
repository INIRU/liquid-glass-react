import { useRef, useState, useEffect, useCallback } from "react"
import LiquidGlassOriginal from "../../../liquid-original"
import LiquidGlassOptimized from "../../../liquid-optimized"
import Link from "next/link"

// ===== Types =====
interface FrameSample { time: number; fps: number; frameTime: number; phase: string }
interface PhaseResult {
  name: string; color: string; startTime: number; endTime: number
  avgFps: number; minFps: number; maxFps: number; p95FrameTime: number
  elementCount: number; renderCount: number
}
type BenchState = "idle" | "running" | "complete"
type Round = "original" | "optimized"

// Interleaved step: phase index + which round
interface BenchStep { phaseIdx: number; round: Round }

// ===== Constants =====
const PHASES = [
  { name: "Baseline", duration: 3000, color: "#6366f1" },
  { name: "Spawn Storm", duration: 7000, color: "#f97316" },
  { name: "BG Chaos", duration: 5000, color: "#8b5cf6" },
  { name: "Mouse Tornado", duration: 5000, color: "#3b82f6" },
  { name: "Content Churn", duration: 5000, color: "#10b981" },
  { name: "Combined", duration: 8000, color: "#ef4444" },
]
const TOTAL_DURATION = PHASES.reduce((s, p) => s + p.duration, 0)

// Build interleaved schedule: Phase0-Orig, Phase0-Opt, Phase1-Orig, Phase1-Opt, ...
const BENCH_SCHEDULE: BenchStep[] = PHASES.flatMap((_, i) => [
  { phaseIdx: i, round: "original" as const },
  { phaseIdx: i, round: "optimized" as const },
])

const BACKGROUNDS = [
  "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  "linear-gradient(135deg, #0c0c0c 0%, #1a0a2e 50%, #2d1b69 100%)",
  "linear-gradient(135deg, #1a2a1a 0%, #0f3420 50%, #084028 100%)",
  "linear-gradient(135deg, #2e1a1a 0%, #3e1616 50%, #601010 100%)",
  "linear-gradient(135deg, #2e2e0f 0%, #3e3e16 50%, #605010 100%)",
]

const CONTENTS = ["Liquid Glass", "Stress Test", "Rendering...", "GPU Active", "Frame Check", "Optimized", "Drawing", "Compositing"]

// ===== Helpers =====
function getPhaseState(phaseIndex: number, progress: number) {
  switch (phaseIndex) {
    case 0: return { elementCount: 1, bgIndex: 0, mousePattern: "none" as const, contentChurn: false }
    case 1: return { elementCount: Math.max(1, Math.round(50 * Math.sin(progress * Math.PI))), bgIndex: 0, mousePattern: "circle" as const, contentChurn: false }
    case 2: return { elementCount: 10, bgIndex: Math.floor(progress * 20) % BACKGROUNDS.length, mousePattern: "circle" as const, contentChurn: false }
    case 3: return { elementCount: 10, bgIndex: 0, mousePattern: "tornado" as const, contentChurn: false }
    case 4: return { elementCount: 10, bgIndex: 0, mousePattern: "circle" as const, contentChurn: true }
    case 5: return {
      elementCount: Math.max(5, Math.round(30 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 4)))),
      bgIndex: Math.floor(progress * 15) % BACKGROUNDS.length,
      mousePattern: "tornado" as const, contentChurn: true,
    }
    default: return { elementCount: 1, bgIndex: 0, mousePattern: "none" as const, contentChurn: false }
  }
}

function getElementPosition(index: number, total: number) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(total)))
  const row = Math.floor(index / cols)
  const col = index % cols
  const sx = 80 / Math.max(cols, 1)
  const sy = 65 / Math.max(Math.ceil(total / cols), 1)
  return { top: `${12 + row * sy}%`, left: `${8 + col * sx}%` }
}

function simulateMouse(container: HTMLElement, elapsed: number, pattern: "circle" | "tornado" | "none") {
  if (pattern === "none") return
  const rect = container.getBoundingClientRect()
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2
  const t = elapsed * 0.003
  let x: number, y: number
  if (pattern === "circle") {
    const r = Math.min(rect.width, rect.height) * 0.3
    x = cx + Math.cos(t) * r + Math.sin(t * 2.7) * r * 0.2
    y = cy + Math.sin(t) * r + Math.cos(t * 1.3) * r * 0.2
  } else {
    x = cx + Math.sin(t * 2) * 200 + Math.cos(t * 7.3) * 90
    y = cy + Math.cos(t * 3) * 150 + Math.sin(t * 11.1) * 70
  }
  container.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true }))
}

// ===== Chart: Comparison Timeline =====
function drawComparisonTimeline(canvas: HTMLCanvasElement, origSamples: FrameSample[], optSamples: FrameSample[], origPhases: PhaseResult[], optPhases: PhaseResult[]) {
  const ctx = canvas.getContext("2d")
  if (!ctx || origSamples.length === 0) return
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth, h = canvas.clientHeight
  canvas.width = w * dpr; canvas.height = h * dpr
  ctx.scale(dpr, dpr)

  const pad = { top: 30, right: 20, bottom: 35, left: 45 }
  const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom
  const maxTime = Math.max(origSamples[origSamples.length - 1]?.time || 1, optSamples[optSamples.length - 1]?.time || 1)
  const maxFPS = 120

  ctx.fillStyle = "#0a0a12"; ctx.fillRect(0, 0, w, h)

  // Grid
  ctx.lineWidth = 1
  for (const fps of [15, 30, 45, 60, 90]) {
    const y = pad.top + ch * (1 - fps / maxFPS)
    ctx.strokeStyle = "rgba(255,255,255,0.06)"
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke()
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "10px system-ui"; ctx.textAlign = "right"
    ctx.fillText(`${fps}`, pad.left - 6, y + 3)
  }

  // Phase regions (from optimized run)
  const phases = optPhases.length > 0 ? optPhases : origPhases
  for (const pr of phases) {
    const x1 = pad.left + (pr.startTime / maxTime) * cw
    const x2 = pad.left + (pr.endTime / maxTime) * cw
    ctx.fillStyle = pr.color + "10"; ctx.fillRect(x1, pad.top, x2 - x1, ch)
    ctx.strokeStyle = pr.color + "25"; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x1, pad.top); ctx.lineTo(x1, pad.top + ch); ctx.stroke()
    ctx.fillStyle = pr.color + "88"; ctx.font = "bold 9px system-ui"; ctx.textAlign = "center"
    ctx.fillText(pr.name, (x1 + x2) / 2, pad.top + 12)
  }

  // 60/30 fps lines
  ctx.setLineDash([4, 4])
  for (const [fps, col] of [[60, "rgba(74,222,128,0.2)"], [30, "rgba(251,191,36,0.2)"]] as const) {
    const y = pad.top + ch * (1 - (fps as number) / maxFPS)
    ctx.strokeStyle = col; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke()
  }
  ctx.setLineDash([])

  // Draw FPS lines
  const drawLine = (samples: FrameSample[], color: string, alpha: number) => {
    if (samples.length === 0) return
    const step = Math.max(1, Math.floor(samples.length / (cw * 2)))
    ctx.beginPath()
    let started = false
    for (let i = 0; i < samples.length; i += step) {
      const s = samples[i]
      const x = pad.left + (s.time / maxTime) * cw
      const y = pad.top + ch * (1 - Math.min(s.fps, maxFPS) / maxFPS)
      if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = alpha; ctx.stroke(); ctx.globalAlpha = 1
  }

  drawLine(origSamples, "#f87171", 0.7) // Original: red
  drawLine(optSamples, "#4ade80", 0.9)  // Optimized: green

  // Legend
  const lx = w - pad.right - 140, ly = pad.top + 8
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(lx, ly, 130, 38)
  ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.strokeRect(lx, ly, 130, 38)
  for (const [label, color, yOff] of [["Original", "#f87171", 0], ["Optimized", "#4ade80", 18]] as const) {
    ctx.fillStyle = color as string; ctx.fillRect(lx + 8, ly + 6 + (yOff as number), 12, 3)
    ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.font = "11px system-ui"; ctx.textAlign = "left"
    ctx.fillText(label as string, lx + 26, ly + 11 + (yOff as number))
  }

  // X-axis
  ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "10px system-ui"; ctx.textAlign = "center"
  const totalSec = maxTime / 1000, xStep = totalSec > 25 ? 5 : 3
  for (let s = 0; s <= totalSec; s += xStep) ctx.fillText(`${s}s`, pad.left + (s * 1000 / maxTime) * cw, h - pad.bottom + 16)
}

// ===== Chart: Phase Comparison Bars =====
function drawComparisonBars(canvas: HTMLCanvasElement, origPhases: PhaseResult[], optPhases: PhaseResult[]) {
  const ctx = canvas.getContext("2d")
  if (!ctx || origPhases.length === 0) return
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth, h = canvas.clientHeight
  canvas.width = w * dpr; canvas.height = h * dpr
  ctx.scale(dpr, dpr)

  ctx.fillStyle = "#0a0a12"; ctx.fillRect(0, 0, w, h)

  const padL = 110, padR = 100, barH = 11, gap = 6, groupGap = 16
  const barAreaW = w - padL - padR
  const maxFPS = 90

  origPhases.forEach((orig, i) => {
    const opt = optPhases[i]
    const gy = 14 + i * (barH * 2 + gap + groupGap)

    // Phase name
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "12px system-ui"; ctx.textAlign = "right"
    ctx.fillText(orig.name, padL - 12, gy + barH + 2)

    // Original bar
    const origW = Math.min(1, orig.avgFps / maxFPS) * barAreaW
    ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(padL, gy, barAreaW, barH)
    ctx.fillStyle = "#f8717140"; ctx.fillRect(padL, gy, Math.max(4, origW), barH)
    ctx.fillStyle = "#f87171"; ctx.font = "bold 10px system-ui"; ctx.textAlign = "left"
    ctx.fillText(`${Math.round(orig.avgFps)}`, padL + Math.max(4, origW) + 6, gy + barH - 1)

    // Optimized bar
    if (opt) {
      const optW = Math.min(1, opt.avgFps / maxFPS) * barAreaW
      const oy = gy + barH + gap
      ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(padL, oy, barAreaW, barH)
      ctx.fillStyle = "#4ade8040"; ctx.fillRect(padL, oy, Math.max(4, optW), barH)
      ctx.fillStyle = "#4ade80"; ctx.font = "bold 10px system-ui"
      ctx.fillText(`${Math.round(opt.avgFps)}`, padL + Math.max(4, optW) + 6, oy + barH - 1)
    }

    // Improvement indicator
    if (opt) {
      const improvement = ((opt.avgFps - orig.avgFps) / Math.max(orig.avgFps, 1)) * 100
      const ix = w - padR + 12
      ctx.fillStyle = improvement >= 0 ? "#4ade80" : "#f87171"
      ctx.font = "bold 11px system-ui"; ctx.textAlign = "left"
      ctx.fillText(`${improvement >= 0 ? "+" : ""}${Math.round(improvement)}%`, ix, gy + barH + gap / 2 + 3)
    }
  })

  // Legend
  ctx.fillStyle = "#f87171"; ctx.fillRect(padL, h - 24, 10, 3)
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "10px system-ui"; ctx.textAlign = "left"
  ctx.fillText("Original", padL + 14, h - 20)
  ctx.fillStyle = "#4ade80"; ctx.fillRect(padL + 90, h - 24, 10, 3)
  ctx.fillStyle = "rgba(255,255,255,0.5)"
  ctx.fillText("Optimized", padL + 104, h - 20)
}

// ===== Chart: Render Count Comparison =====
function drawRenderComparison(canvas: HTMLCanvasElement, origPhases: PhaseResult[], optPhases: PhaseResult[]) {
  const ctx = canvas.getContext("2d")
  if (!ctx || origPhases.length === 0) return
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth, h = canvas.clientHeight
  canvas.width = w * dpr; canvas.height = h * dpr
  ctx.scale(dpr, dpr)

  ctx.fillStyle = "#0a0a12"; ctx.fillRect(0, 0, w, h)

  const padL = 110, padR = 80, barH = 14, gap = 6, groupGap = 12
  const barAreaW = w - padL - padR
  const maxRenders = Math.max(...origPhases.map(p => p.renderCount), ...optPhases.map(p => p.renderCount), 1)

  origPhases.forEach((orig, i) => {
    const opt = optPhases[i]
    const gy = 14 + i * (barH * 2 + gap + groupGap)

    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "12px system-ui"; ctx.textAlign = "right"
    ctx.fillText(orig.name, padL - 12, gy + barH + 2)

    // Original
    const origW = (orig.renderCount / maxRenders) * barAreaW
    ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(padL, gy, barAreaW, barH)
    ctx.fillStyle = "#f8717130"; ctx.fillRect(padL, gy, Math.max(4, origW), barH)
    ctx.fillStyle = "#f87171cc"; ctx.font = "10px system-ui"; ctx.textAlign = "left"
    ctx.fillText(`${orig.renderCount.toLocaleString()}`, padL + Math.max(4, origW) + 6, gy + barH - 2)

    // Optimized
    if (opt) {
      const optW = (opt.renderCount / maxRenders) * barAreaW
      const oy = gy + barH + gap
      ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(padL, oy, barAreaW, barH)
      ctx.fillStyle = "#4ade8030"; ctx.fillRect(padL, oy, Math.max(4, optW), barH)
      ctx.fillStyle = "#4ade80cc"; ctx.font = "10px system-ui"
      ctx.fillText(`${opt.renderCount.toLocaleString()}`, padL + Math.max(4, optW) + 6, oy + barH - 2)

      // Ratio
      const ratio = orig.renderCount > 0 ? (orig.renderCount / Math.max(opt.renderCount, 1)).toFixed(1) : "-"
      ctx.fillStyle = "#fbbf24"; ctx.font = "bold 11px system-ui"
      ctx.fillText(`${ratio}x`, w - padR + 12, gy + barH + gap / 2 + 3)
    }
  })

  ctx.fillStyle = "#f87171"; ctx.fillRect(padL, h - 24, 10, 3)
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "10px system-ui"; ctx.textAlign = "left"
  ctx.fillText("Original", padL + 14, h - 20)
  ctx.fillStyle = "#4ade80"; ctx.fillRect(padL + 90, h - 24, 10, 3)
  ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillText("Optimized", padL + 104, h - 20)
}

// ===== Main Component =====
export default function StressBenchmark() {
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLCanvasElement>(null)
  const barsRef = useRef<HTMLCanvasElement>(null)
  const rendersRef = useRef<HTMLCanvasElement>(null)

  const [benchState, setBenchState] = useState<BenchState>("idle")
  const [stepIdx, setStepIdx] = useState(-1)  // Index into BENCH_SCHEDULE
  const [liveFps, setLiveFps] = useState(0)
  const [liveCount, setLiveCount] = useState(0)
  const [liveBg, setLiveBg] = useState(0)
  const [liveContent, setLiveContent] = useState(0)
  const [liveMouse, setLiveMouse] = useState<"none" | "circle" | "tornado">("none")
  const [, setProgress] = useState(0)

  const [origResults, setOrigResults] = useState<PhaseResult[]>([])
  const [optResults, setOptResults] = useState<PhaseResult[]>([])

  const origSamplesRef = useRef<FrameSample[]>([])
  const optSamplesRef = useRef<FrameSample[]>([])
  const origResultsRef = useRef<PhaseResult[]>([])
  const optResultsRef = useRef<PhaseResult[]>([])
  // Track total render callback invocations (not per-element cumulative count)
  const renderCallCount = useRef(0)

  const fpsFrames = useRef(0)
  const fpsLast = useRef(0)
  const stateUpdateLast = useRef(0)

  // Derive current step info
  const currentStep = stepIdx >= 0 && stepIdx < BENCH_SCHEDULE.length ? BENCH_SCHEDULE[stepIdx] : null
  const round: Round = currentStep?.round || "original"
  const phaseIdx = currentStep?.phaseIdx ?? -1

  const handleRenderCount = useCallback((_count: number) => { renderCallCount.current++ }, [])

  const start = useCallback(() => {
    origSamplesRef.current = []; optSamplesRef.current = []
    origResultsRef.current = []; optResultsRef.current = []
    setOrigResults([]); setOptResults([])
    setBenchState("running")
    setStepIdx(0)
    setProgress(0)
    renderCallCount.current = 0
  }, [])

  const reset = useCallback(() => {
    setBenchState("idle"); setStepIdx(-1)
    setLiveFps(0); setLiveCount(0); setLiveBg(0); setLiveContent(0); setLiveMouse("none"); setProgress(0)
    origSamplesRef.current = []; optSamplesRef.current = []
    origResultsRef.current = []; optResultsRef.current = []
    setOrigResults([]); setOptResults([])
    renderCallCount.current = 0
  }, [])

  // Main benchmark loop — interleaved: Phase0-Orig, Phase0-Opt, Phase1-Orig, Phase1-Opt, ...
  useEffect(() => {
    if (benchState !== "running" || stepIdx < 0) return

    // All steps done?
    if (stepIdx >= BENCH_SCHEDULE.length) {
      setOrigResults([...origResultsRef.current])
      setOptResults([...optResultsRef.current])
      setBenchState("complete")
      if (typeof window !== "undefined") {
        ;(window as any).__BENCHMARK_RESULTS__ = {
          original: { phases: origResultsRef.current, samples: origSamplesRef.current },
          optimized: { phases: optResultsRef.current, samples: optSamplesRef.current },
        }
      }
      return
    }

    const step = BENCH_SCHEDULE[stepIdx]
    const phase = PHASES[step.phaseIdx]
    const isOrig = step.round === "original"
    const samplesArr = isOrig ? origSamplesRef.current : optSamplesRef.current
    const phaseStart = samplesArr.length > 0 ? samplesArr[samplesArr.length - 1].time : 0
    const startMs = performance.now()
    let prevFrame = startMs
    const phaseSamples: FrameSample[] = []
    let maxElems = 0
    const startRenders = renderCallCount.current
    let id: number

    fpsLast.current = startMs
    fpsFrames.current = 0
    stateUpdateLast.current = startMs

    const tick = () => {
      const now = performance.now()
      const elapsed = now - startMs
      const frameTime = now - prevFrame
      prevFrame = now
      const prog = Math.min(1, elapsed / phase.duration)
      const instantFps = frameTime > 0 ? 1000 / frameTime : 60

      fpsFrames.current++
      if (now - fpsLast.current >= 500) {
        setLiveFps(Math.round(fpsFrames.current / ((now - fpsLast.current) / 1000)))
        fpsFrames.current = 0; fpsLast.current = now
      }

      const ps = getPhaseState(step.phaseIdx, prog)
      maxElems = Math.max(maxElems, ps.elementCount)

      if (now - stateUpdateLast.current > 100) {
        setLiveCount(ps.elementCount); setLiveBg(ps.bgIndex); setLiveMouse(ps.mousePattern); setProgress(prog)
        if (ps.contentChurn) setLiveContent(Math.floor(elapsed / 150) % CONTENTS.length)
        stateUpdateLast.current = now
      }

      if (containerRef.current && ps.mousePattern !== "none") {
        simulateMouse(containerRef.current, elapsed, ps.mousePattern)
      }

      const sample: FrameSample = { time: phaseStart + elapsed, fps: instantFps, frameTime, phase: phase.name }
      samplesArr.push(sample)
      phaseSamples.push(sample)

      if (elapsed < phase.duration) {
        id = requestAnimationFrame(tick)
      } else {
        const fpsList = phaseSamples.map(s => s.fps).filter(f => f > 0 && f < 300)
        const fts = phaseSamples.map(s => s.frameTime).filter(t => t > 0).sort((a, b) => a - b)
        const avg = fpsList.length > 0 ? fpsList.reduce((a, b) => a + b, 0) / fpsList.length : 0
        const result: PhaseResult = {
          name: phase.name, color: phase.color, startTime: phaseStart, endTime: phaseStart + elapsed,
          avgFps: avg, minFps: fpsList.length > 0 ? Math.min(...fpsList) : 0,
          maxFps: fpsList.length > 0 ? Math.max(...fpsList) : 0,
          p95FrameTime: fts[Math.floor(fts.length * 0.95)] || 0,
          elementCount: maxElems, renderCount: renderCallCount.current - startRenders,
        }
        if (isOrig) origResultsRef.current.push(result)
        else optResultsRef.current.push(result)

        // 300ms cooldown between steps to let GC settle, ensuring fair comparison
        setTimeout(() => setStepIdx(i => i + 1), 300)
      }
    }

    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [benchState, stepIdx])

  // Draw charts when complete
  useEffect(() => {
    if (benchState !== "complete") return
    if (timelineRef.current) drawComparisonTimeline(timelineRef.current, origSamplesRef.current, optSamplesRef.current, origResults, optResults)
    if (barsRef.current) drawComparisonBars(barsRef.current, origResults, optResults)
    if (rendersRef.current) drawRenderComparison(rendersRef.current, origResults, optResults)
  }, [benchState, origResults, optResults])

  // Auto-start
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("auto") === "true") setTimeout(() => start(), 500)
  }, [start])

  const GlassComponent = round === "original" ? LiquidGlassOriginal : LiquidGlassOptimized
  const fpsColor = liveFps >= 55 ? "#4ade80" : liveFps >= 30 ? "#fbbf24" : "#f87171"
  const currentPhase = phaseIdx >= 0 && phaseIdx < PHASES.length ? PHASES[phaseIdx] : null
  const totalSteps = BENCH_SCHEDULE.length
  const overallProgress = benchState === "running" ? stepIdx / totalSteps : benchState === "complete" ? 1 : 0

  // Scores
  const calcScore = (results: PhaseResult[]) => {
    if (results.length === 0) return 0
    const weights = [1, 2, 1.5, 1.5, 1.5, 3]
    let tw = 0, ws = 0
    results.forEach((pr, i) => { const w = weights[i] || 1; tw += w; ws += (Math.min(pr.avgFps, 60) / 60) * w })
    return Math.round((ws / tw) * 100)
  }
  const origScore = calcScore(origResults)
  const optScore = calcScore(optResults)

  return (
    <div style={{ minHeight: "100vh", background: "#08080d", color: "white", fontFamily: "'SF Pro Text', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.01)", backdropFilter: "blur(8px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link href="/" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: "12px", padding: "4px 8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.15s ease" }}>&#8592; Back</Link>
          <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.08)" }} />
          <h1 style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-0.01em", margin: 0, color: "rgba(255,255,255,0.85)" }}>Stress Benchmark</h1>
          {benchState === "running" && (
            <>
              <span style={{
                padding: "4px 10px", borderRadius: "6px", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em",
                background: round === "original" ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)",
                border: `1px solid ${round === "original" ? "rgba(248,113,113,0.2)" : "rgba(74,222,128,0.2)"}`,
                color: round === "original" ? "#f87171" : "#4ade80",
                boxShadow: `0 0 8px ${round === "original" ? "rgba(248,113,113,0.1)" : "rgba(74,222,128,0.1)"}`,
              }}>
                {round === "original" ? "ORIGINAL" : "OPTIMIZED"}
              </span>
              {currentPhase && (
                <span style={{
                  padding: "4px 10px", borderRadius: "6px", fontSize: "10px", fontWeight: 600,
                  background: currentPhase.color + "12",
                  border: `1px solid ${currentPhase.color}30`,
                  color: currentPhase.color,
                  boxShadow: `0 0 8px ${currentPhase.color}10`,
                }}>
                  {currentPhase.name}
                </span>
              )}
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          {benchState === "running" && (
            <>
              <Stat label="FPS" value={liveFps} color={fpsColor} />
              <Stat label="Elements" value={liveCount} color="rgba(255,255,255,0.9)" />
              <Stat label="Progress" value={`${Math.round(overallProgress * 100)}%`} color="rgba(255,255,255,0.6)" />
            </>
          )}
          {benchState === "complete" && (
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 12px", borderRadius: "8px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.12)" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#f87171" }} />
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Original</span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#f87171", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>{origScore}</span>
              </div>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.15)", fontWeight: 500 }}>vs</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "5px 12px", borderRadius: "8px", background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.12)" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#4ade80" }} />
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>Optimized</span>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#4ade80", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>{optScore}</span>
              </div>
              {optScore !== origScore && (
                <div style={{
                  padding: "4px 10px", borderRadius: "6px",
                  background: optScore > origScore ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                  fontSize: "12px", fontWeight: 700,
                  color: optScore > origScore ? "#4ade80" : "#f87171",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {optScore > origScore ? "+" : ""}{optScore - origScore}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: "10px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: "10px", alignItems: "center", background: "rgba(255,255,255,0.008)" }}>
        <button onClick={benchState === "running" ? reset : start} style={{
          padding: "8px 20px", borderRadius: "10px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "12px", fontFamily: "inherit",
          background: benchState === "running"
            ? "linear-gradient(135deg, #ef4444, #dc2626)"
            : benchState === "complete"
              ? "linear-gradient(135deg, #6366f1, #4f46e5)"
              : "linear-gradient(135deg, #3b82f6, #2563eb)",
          color: "white",
          boxShadow: benchState === "running"
            ? "0 2px 12px rgba(239,68,68,0.3)"
            : "0 2px 12px rgba(59,130,246,0.3)",
          letterSpacing: "-0.01em",
        }}>
          {benchState === "idle" ? "Start Benchmark" : benchState === "running" ? "Stop" : "Run Again"}
        </button>
        {benchState === "complete" && (
          <>
            <button onClick={reset} style={{ padding: "7px 18px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontWeight: 500, fontSize: "12px", fontFamily: "inherit" }}>Reset</button>
            <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)", margin: "0 4px" }} />
            <button
              onClick={() => downloadReport(origResults, optResults, origSamplesRef.current, optSamplesRef.current, origScore, optScore)}
              style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: 500, fontSize: "11px", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "5px" }}
            >
              <span style={{ fontSize: "13px" }}>{"\u2913"}</span> CSV
            </button>
            <button
              onClick={() => downloadJSON(origResults, optResults, origSamplesRef.current, optSamplesRef.current, origScore, optScore)}
              style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontWeight: 500, fontSize: "11px", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "5px" }}
            >
              <span style={{ fontSize: "13px" }}>{"\u2913"}</span> JSON
            </button>
          </>
        )}
        <Link href="/benchmark" style={{ marginLeft: "8px", color: "rgba(255,255,255,0.4)", textDecoration: "none", fontSize: "12px" }}>Side-by-Side &#8594;</Link>
        {benchState === "running" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: "4px", alignItems: "center" }}>
            {BENCH_SCHEDULE.map((s, i) => {
              const p = PHASES[s.phaseIdx]
              const isOpt = s.round === "optimized"
              return <div key={i} style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: i < stepIdx ? p.color : i === stepIdx ? p.color : "rgba(255,255,255,0.1)",
                opacity: i <= stepIdx ? 1 : 0.3,
                boxShadow: i === stepIdx ? `0 0 6px ${p.color}` : "none",
                outline: isOpt ? `1px solid ${p.color}40` : "none",
              }} />
            })}
          </div>
        )}
      </div>

      {/* Content */}
      {benchState === "complete" ? (
        <div style={{ position: "relative", minHeight: "calc(100vh - 100px)", overflow: "hidden" }}>
          {/* Atmospheric background */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)", backgroundSize: "48px 48px", pointerEvents: "none" }} />

          <div style={{ position: "relative", padding: "36px 32px 48px", maxWidth: "1100px", margin: "0 auto" }}>

            {/* Hero Score Section */}
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "48px", marginBottom: "48px", flexWrap: "wrap", animation: "fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1) both" }}>
              <ScoreCard label="Original" score={origScore} color="#f87171" isWinner={origScore > optScore} />

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontWeight: 500, letterSpacing: "0.15em", textTransform: "uppercase" }}>versus</div>
                <div style={{
                  width: "1px", height: "40px",
                  background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.15), transparent)",
                }} />
                {optScore !== origScore && (
                  <div style={{
                    padding: "6px 14px", borderRadius: "20px",
                    background: optScore > origScore ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                    border: `1px solid ${optScore > origScore ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`,
                  }}>
                    <span style={{
                      fontSize: "13px", fontWeight: 700, letterSpacing: "-0.02em",
                      color: optScore > origScore ? "#4ade80" : "#f87171",
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      {optScore > origScore ? "+" : ""}{optScore - origScore} pts
                    </span>
                  </div>
                )}
              </div>

              <ScoreCard label="Optimized" score={optScore} color="#4ade80" isWinner={optScore > origScore} />
            </div>

            {/* Quick stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "36px", animation: "fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 50ms both" }}>
              {(() => {
                const totalOrigRenders = origResults.reduce((s, r) => s + r.renderCount, 0)
                const totalOptRenders = optResults.reduce((s, r) => s + r.renderCount, 0)
                const avgOrigFps = origResults.length > 0 ? origResults.reduce((s, r) => s + r.avgFps, 0) / origResults.length : 0
                const avgOptFps = optResults.length > 0 ? optResults.reduce((s, r) => s + r.avgFps, 0) / optResults.length : 0
                const renderReduction = totalOrigRenders > 0 ? ((1 - totalOptRenders / totalOrigRenders) * 100) : 0
                const fpsGain = avgOrigFps > 0 ? ((avgOptFps - avgOrigFps) / avgOrigFps * 100) : 0
                return [
                  { label: "Avg FPS Gain", value: `${fpsGain >= 0 ? "+" : ""}${Math.round(fpsGain)}%`, color: fpsGain >= 0 ? "#4ade80" : "#f87171" },
                  { label: "Render Reduction", value: `${Math.round(renderReduction)}%`, color: renderReduction > 0 ? "#4ade80" : "#f87171" },
                  { label: "Total Orig Renders", value: totalOrigRenders.toLocaleString(), color: "#f87171" },
                  { label: "Total Opt Renders", value: totalOptRenders.toLocaleString(), color: "#4ade80" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    padding: "14px 16px", borderRadius: "12px",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    backdropFilter: "blur(8px)",
                  }}>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "6px" }}>{label}</div>
                    <div style={{ fontSize: "20px", fontWeight: 700, color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value}</div>
                  </div>
                ))
              })()}
            </div>

            {/* Charts */}
            <GlassPanel title="FPS Timeline" subtitle="Original vs Optimized over time" delay={100}>
              <canvas ref={timelineRef} style={{ width: "100%", height: "300px", borderRadius: "8px" }} />
            </GlassPanel>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
              <GlassPanel title="Average FPS" subtitle="Per phase comparison" delay={200}>
                <canvas ref={barsRef} style={{ width: "100%", height: "300px", borderRadius: "8px" }} />
              </GlassPanel>
              <GlassPanel title="Render Counts" subtitle="React re-render comparison" delay={250}>
                <canvas ref={rendersRef} style={{ width: "100%", height: "300px", borderRadius: "8px" }} />
              </GlassPanel>
            </div>

            {/* Detailed Results Table */}
            <GlassPanel title="Phase Breakdown" subtitle="Detailed per-phase metrics" delay={350} style={{ marginTop: "16px" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0 4px", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      {["Phase", "Orig FPS", "Opt FPS", "FPS Delta", "Orig Renders", "Opt Renders", "Ratio", "Peak Elements"].map(h => (
                        <th key={h} style={{
                          padding: "10px 12px", textAlign: "left",
                          color: "rgba(255,255,255,0.3)", fontWeight: 500,
                          textTransform: "uppercase", letterSpacing: "0.08em", fontSize: "9px",
                          borderBottom: "1px solid rgba(255,255,255,0.06)",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {origResults.map((orig, i) => {
                      const opt = optResults[i]
                      const fpsImprovement = opt ? ((opt.avgFps - orig.avgFps) / Math.max(orig.avgFps, 1)) * 100 : 0
                      const renderRatio = opt && opt.renderCount > 0 ? (orig.renderCount / opt.renderCount).toFixed(1) : "-"
                      const isPositive = fpsImprovement >= 0
                      return (
                        <tr key={orig.name} style={{
                          background: "rgba(255,255,255,0.02)",
                          borderRadius: "8px",
                        }}>
                          <td style={{ padding: "12px", fontWeight: 600, borderRadius: "8px 0 0 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div style={{
                                width: "6px", height: "24px", borderRadius: "3px",
                                background: `linear-gradient(to bottom, ${orig.color}, ${orig.color}60)`,
                              }} />
                              <div>
                                <div style={{ fontSize: "12px", fontWeight: 600 }}>{orig.name}</div>
                                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "1px" }}>
                                  {(PHASES[i].duration / 1000).toFixed(0)}s duration
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "12px", fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: "#f87171", fontWeight: 600 }}>{Math.round(orig.avgFps)}</span>
                            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", marginLeft: "2px" }}>fps</span>
                          </td>
                          <td style={{ padding: "12px", fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ color: "#4ade80", fontWeight: 600 }}>{opt ? Math.round(opt.avgFps) : "-"}</span>
                            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px", marginLeft: "2px" }}>fps</span>
                          </td>
                          <td style={{ padding: "12px", fontVariantNumeric: "tabular-nums" }}>
                            <div style={{
                              display: "inline-flex", alignItems: "center", gap: "4px",
                              padding: "3px 8px", borderRadius: "6px",
                              background: isPositive ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                            }}>
                              <span style={{ fontSize: "10px" }}>{isPositive ? "\u25B2" : "\u25BC"}</span>
                              <span style={{ fontWeight: 700, fontSize: "11px", color: isPositive ? "#4ade80" : "#f87171" }}>
                                {isPositive ? "+" : ""}{Math.round(fpsImprovement)}%
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "12px", fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.45)" }}>
                            {orig.renderCount.toLocaleString()}
                          </td>
                          <td style={{ padding: "12px", fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.45)" }}>
                            {opt ? opt.renderCount.toLocaleString() : "-"}
                          </td>
                          <td style={{ padding: "12px", fontVariantNumeric: "tabular-nums" }}>
                            <span style={{ fontWeight: 700, color: "#fbbf24", fontSize: "12px" }}>{renderRatio}x</span>
                          </td>
                          <td style={{ padding: "12px", fontVariantNumeric: "tabular-nums", color: "rgba(255,255,255,0.45)", borderRadius: "0 8px 8px 0" }}>
                            {orig.elementCount}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          </div>
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{
            height: "calc(100vh - 100px)", position: "relative", overflow: "hidden",
            background: BACKGROUNDS[liveBg % BACKGROUNDS.length], transition: "background 0.4s ease",
          }}
        >
          <div style={{ position: "absolute", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)", top: "15%", left: "25%", filter: "blur(40px)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%)", bottom: "10%", right: "15%", filter: "blur(30px)", pointerEvents: "none" }} />

          {benchState === "idle" && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "20px", zIndex: 10 }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "16px",
                background: "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(236,72,153,0.2))",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 40px rgba(99,102,241,0.15)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, color: "rgba(255,255,255,0.85)", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
                  Performance Stress Test
                </h2>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", maxWidth: "400px", textAlign: "center", lineHeight: 1.8, margin: 0 }}>
                  6 stress phases, <b style={{ color: "rgba(255,255,255,0.5)" }}>interleaved</b> between{" "}
                  <span style={{ color: "#f87171", fontWeight: 600 }}>Original</span> and{" "}
                  <span style={{ color: "#4ade80", fontWeight: 600 }}>Optimized</span> for fair comparison.
                </p>
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                {PHASES.map(p => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: p.color, opacity: 0.6 }} />
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>{p.name}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>
                ~{Math.round(TOTAL_DURATION * 2 / 1000)}s total duration
              </div>
            </div>
          )}

          {benchState === "running" && Array.from({ length: liveCount }, (_, i) => {
            const pos = getElementPosition(i, liveCount)
            return (
              <GlassComponent
                key={i}
                displacementScale={70}
                blurAmount={0.3}
                saturation={140}
                aberrationIntensity={2}
                elasticity={0.12}
                cornerRadius={18}
                padding="10px 16px"
                mouseContainer={containerRef}
                onRenderCount={handleRenderCount}
                style={{ position: "absolute", top: pos.top, left: pos.left }}
              >
                <div style={{ width: "110px" }}>
                  <p style={{ fontFamily: "system-ui", fontWeight: 600, fontSize: "11px", color: "white", margin: 0 }}>
                    {liveMouse === "none" ? `Glass #${i + 1}` : CONTENTS[liveContent % CONTENTS.length]}
                  </p>
                  <p style={{ fontFamily: "system-ui", fontSize: "9px", color: "rgba(255,255,255,0.45)", margin: "2px 0 0" }}>
                    {currentPhase?.name || "Ready"}
                  </p>
                </div>
              </GlassComponent>
            )
          })}

          {benchState === "running" && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "3px", background: "rgba(255,255,255,0.03)" }}>
              <div style={{
                height: "100%", width: `${overallProgress * 100}%`,
                background: round === "original"
                  ? "linear-gradient(90deg, #f87171, #fb923c)"
                  : "linear-gradient(90deg, #4ade80, #22d3ee)",
                transition: "width 0.3s linear",
                boxShadow: round === "original"
                  ? "0 0 12px rgba(248,113,113,0.4)"
                  : "0 0 12px rgba(74,222,128,0.4)",
              }} />
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scoreReveal {
          from { stroke-dashoffset: ${2 * Math.PI * 54}; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        button:hover { filter: brightness(1.15); transform: translateY(-1px); }
        button:active { transform: translateY(1px); filter: brightness(0.95); }
        button { transition: all 0.15s ease; }
        a:hover { color: rgba(255,255,255,0.8) !important; }
        table tr { transition: background 0.15s ease; }
        table tbody tr:hover { background: rgba(255,255,255,0.04) !important; }
        svg circle[stroke-dasharray] {
          animation: scoreReveal 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
      `}</style>
    </div>
  )
}

// ===== Small Components =====
function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ textAlign: "right", padding: "4px 0" }}>
      <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500, marginBottom: "2px" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, fontVariantNumeric: "tabular-nums", color, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
    </div>
  )
}

function ScoreCard({ label, score, color, isWinner = false }: { label: string; score: number; color: string; isWinner?: boolean }) {
  const radius = 54
  const stroke = 5
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)

  return (
    <div style={{
      padding: "28px 32px 24px", borderRadius: "20px", textAlign: "center", minWidth: "160px",
      background: isWinner
        ? `linear-gradient(135deg, ${color}0a, ${color}15)`
        : "rgba(255,255,255,0.02)",
      border: `1px solid ${isWinner ? color + "30" : "rgba(255,255,255,0.06)"}`,
      boxShadow: isWinner ? `0 0 40px ${color}10, 0 8px 32px rgba(0,0,0,0.3)` : "0 8px 32px rgba(0,0,0,0.2)",
      position: "relative",
      overflow: "hidden",
    }}>
      {isWinner && (
        <div style={{
          position: "absolute", top: "10px", right: "12px",
          padding: "3px 8px", borderRadius: "6px",
          background: `${color}18`, border: `1px solid ${color}30`,
          fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
          color, textTransform: "uppercase",
        }}>
          Winner
        </div>
      )}
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "16px" }}>
        {label}
      </div>
      <div style={{ position: "relative", width: "120px", height: "120px", margin: "0 auto 12px" }}>
        <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={stroke} />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: "32px", fontWeight: 800, color, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", lineHeight: 1 }}>
            {score}
          </div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "4px", fontWeight: 500 }}>/ 100</div>
        </div>
      </div>
    </div>
  )
}

function GlassPanel({ title, subtitle, children, style: extraStyle = {}, delay = 0 }: { title: string; subtitle?: string; children: React.ReactNode; style?: React.CSSProperties; delay?: number }) {
  return (
    <div style={{
      borderRadius: "16px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      overflow: "hidden",
      backdropFilter: "blur(12px)",
      animation: `fadeInUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms both`,
      ...extraStyle,
    }}>
      <div style={{
        padding: "14px 18px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex", alignItems: "baseline", gap: "10px",
      }}>
        <h3 style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.8)", letterSpacing: "-0.01em" }}>{title}</h3>
        {subtitle && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontWeight: 400 }}>{subtitle}</span>}
      </div>
      <div style={{ padding: "14px" }}>
        {children}
      </div>
    </div>
  )
}

function downloadReport(origResults: PhaseResult[], optResults: PhaseResult[], origSamples: FrameSample[], optSamples: FrameSample[], origScore: number, optScore: number) {
  const now = new Date()
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19)

  // Build CSV
  const csvLines: string[] = []
  csvLines.push("Liquid Glass Stress Benchmark Report")
  csvLines.push(`Generated: ${now.toLocaleString()}`)
  csvLines.push("")
  csvLines.push(`Overall Score,Original: ${origScore}/100,Optimized: ${optScore}/100,Delta: ${optScore - origScore > 0 ? "+" : ""}${optScore - origScore}`)
  csvLines.push("")
  csvLines.push("Phase,Orig Avg FPS,Opt Avg FPS,FPS Delta %,Orig Min FPS,Opt Min FPS,Orig Max FPS,Opt Max FPS,Orig P95 Frame(ms),Opt P95 Frame(ms),Orig Renders,Opt Renders,Render Ratio,Peak Elements")

  origResults.forEach((orig, i) => {
    const opt = optResults[i]
    const fpsDelta = opt ? (((opt.avgFps - orig.avgFps) / Math.max(orig.avgFps, 1)) * 100).toFixed(1) : "N/A"
    const ratio = opt && opt.renderCount > 0 ? (orig.renderCount / opt.renderCount).toFixed(1) : "N/A"
    csvLines.push([
      orig.name,
      orig.avgFps.toFixed(1), opt ? opt.avgFps.toFixed(1) : "N/A", fpsDelta,
      orig.minFps.toFixed(1), opt ? opt.minFps.toFixed(1) : "N/A",
      orig.maxFps.toFixed(1), opt ? opt.maxFps.toFixed(1) : "N/A",
      orig.p95FrameTime.toFixed(2), opt ? opt.p95FrameTime.toFixed(2) : "N/A",
      orig.renderCount, opt ? opt.renderCount : "N/A", ratio, orig.elementCount,
    ].join(","))
  })

  // Totals
  const totalOrigRenders = origResults.reduce((s, r) => s + r.renderCount, 0)
  const totalOptRenders = optResults.reduce((s, r) => s + r.renderCount, 0)
  csvLines.push("")
  csvLines.push(`Totals,,,,,,,,,,${totalOrigRenders},${totalOptRenders},${totalOrigRenders > 0 ? (totalOrigRenders / Math.max(totalOptRenders, 1)).toFixed(1) : "N/A"},`)

  // FPS samples summary
  csvLines.push("")
  csvLines.push("--- FPS Samples (sampled) ---")
  csvLines.push("Time(ms),Original FPS,Optimized FPS")
  const maxLen = Math.max(origSamples.length, optSamples.length)
  const sampleStep = Math.max(1, Math.floor(maxLen / 500))
  for (let i = 0; i < maxLen; i += sampleStep) {
    const os = origSamples[i]
    const ops = optSamples[i]
    const t = os?.time ?? ops?.time ?? 0
    csvLines.push(`${t.toFixed(0)},${os ? os.fps.toFixed(1) : ""},${ops ? ops.fps.toFixed(1) : ""}`)
  }

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `benchmark-report-${ts}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function downloadJSON(origResults: PhaseResult[], optResults: PhaseResult[], origSamples: FrameSample[], optSamples: FrameSample[], origScore: number, optScore: number) {
  const now = new Date()
  const ts = now.toISOString().replace(/[:.]/g, "-").slice(0, 19)

  const report = {
    generated: now.toISOString(),
    scores: { original: origScore, optimized: optScore, delta: optScore - origScore },
    phases: origResults.map((orig, i) => {
      const opt = optResults[i]
      return {
        name: orig.name,
        original: { avgFps: +orig.avgFps.toFixed(1), minFps: +orig.minFps.toFixed(1), maxFps: +orig.maxFps.toFixed(1), p95FrameTime: +orig.p95FrameTime.toFixed(2), renderCount: orig.renderCount, elementCount: orig.elementCount },
        optimized: opt ? { avgFps: +opt.avgFps.toFixed(1), minFps: +opt.minFps.toFixed(1), maxFps: +opt.maxFps.toFixed(1), p95FrameTime: +opt.p95FrameTime.toFixed(2), renderCount: opt.renderCount, elementCount: opt.elementCount } : null,
        fpsDeltaPercent: opt ? +(((opt.avgFps - orig.avgFps) / Math.max(orig.avgFps, 1)) * 100).toFixed(1) : null,
        renderRatio: opt && opt.renderCount > 0 ? +(orig.renderCount / opt.renderCount).toFixed(1) : null,
      }
    }),
    sampleCount: { original: origSamples.length, optimized: optSamples.length },
  }

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `benchmark-report-${ts}.json`
  a.click()
  URL.revokeObjectURL(url)
}
