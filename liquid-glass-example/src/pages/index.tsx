import { useRef } from "react"
import LiquidGlass from "../../../liquid-optimized"
import Link from "next/link"

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={containerRef}
      className="min-h-screen w-full overflow-hidden relative"
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #302b63 40%, #24243e 100%)",
      }}
    >
      {/* Animated gradient orbs for background depth */}
      <div
        style={{
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)",
          top: "-10%",
          right: "-5%",
          filter: "blur(60px)",
          animation: "float1 8s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.3) 0%, transparent 70%)",
          bottom: "5%",
          left: "-8%",
          filter: "blur(50px)",
          animation: "float2 10s ease-in-out infinite",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "350px",
          height: "350px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236,72,153,0.25) 0%, transparent 70%)",
          top: "40%",
          left: "50%",
          filter: "blur(40px)",
          animation: "float3 12s ease-in-out infinite",
        }}
      />

      {/* Grid pattern overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Hero text */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontSize: "clamp(2.5rem, 6vw, 5rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            background: "linear-gradient(to bottom right, #ffffff 30%, rgba(255,255,255,0.4))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            fontFamily: "'SF Pro Display', system-ui, -apple-system, sans-serif",
          }}
        >
          Liquid Glass
        </h1>
        <p
          style={{
            marginTop: "12px",
            fontSize: "clamp(0.9rem, 1.5vw, 1.15rem)",
            color: "rgba(255,255,255,0.45)",
            fontWeight: 400,
            letterSpacing: "0.02em",
            fontFamily: "'SF Pro Text', system-ui, -apple-system, sans-serif",
          }}
        >
          Apple&apos;s Liquid Glass effect for React
        </p>
        <div style={{ display: "flex", gap: "12px", marginTop: "20px", justifyContent: "center" }}>
          <Link
            href="/benchmark"
            style={{
              display: "inline-block",
              padding: "8px 20px",
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "999px",
              textDecoration: "none",
              transition: "all 0.2s ease",
              fontFamily: "'SF Pro Text', system-ui, sans-serif",
            }}
          >
            Benchmark &#8594;
          </Link>
          <Link
            href="/stress-benchmark"
            style={{
              display: "inline-block",
              padding: "8px 20px",
              fontSize: "0.85rem",
              color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "999px",
              textDecoration: "none",
              transition: "all 0.2s ease",
              fontFamily: "'SF Pro Text', system-ui, sans-serif",
            }}
          >
            Stress Test &#8594;
          </Link>
        </div>
      </div>

      {/* Glass Card - User Profile */}
      <LiquidGlass
        displacementScale={90}
        blurAmount={0.5}
        saturation={150}
        aberrationIntensity={3}
        elasticity={0.12}
        cornerRadius={28}
        mouseContainer={containerRef}
        style={{
          position: "absolute",
          top: "38%",
          left: "28%",
        }}
      >
        <div style={{ width: "280px", padding: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "16px",
                background: "linear-gradient(135deg, rgba(139,92,246,0.6), rgba(59,130,246,0.6))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                fontWeight: 700,
                color: "white",
                fontFamily: "system-ui",
              }}
            >
              JD
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: "16px", color: "white", fontFamily: "system-ui", margin: 0 }}>
                John Doe
              </p>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", fontFamily: "system-ui", margin: "2px 0 0" }}>
                Software Engineer
              </p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[
              ["Email", "john@example.com"],
              ["Location", "San Francisco, CA"],
              ["Status", "Available"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontFamily: "system-ui" }}>
                <span style={{ color: "rgba(255,255,255,0.5)" }}>{label}</span>
                <span style={{ color: "rgba(255,255,255,0.9)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </LiquidGlass>

      {/* Glass Button */}
      <LiquidGlass
        displacementScale={64}
        blurAmount={0.1}
        saturation={130}
        aberrationIntensity={2}
        elasticity={0.35}
        cornerRadius={100}
        padding="10px 28px"
        mouseContainer={containerRef}
        onClick={() => console.log("clicked")}
        style={{
          position: "absolute",
          top: "75%",
          left: "35%",
        }}
      >
        <span style={{ fontFamily: "system-ui", fontWeight: 500, fontSize: "15px", color: "white" }}>
          Get Started
        </span>
      </LiquidGlass>

      {/* Glass Notification */}
      <LiquidGlass
        displacementScale={70}
        blurAmount={0.3}
        saturation={140}
        aberrationIntensity={2}
        elasticity={0.08}
        cornerRadius={20}
        padding="14px 20px"
        mouseContainer={containerRef}
        style={{
          position: "absolute",
          top: "30%",
          left: "65%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, rgba(34,197,94,0.7), rgba(16,185,129,0.7))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            ✓
          </div>
          <div>
            <p style={{ fontFamily: "system-ui", fontWeight: 600, fontSize: "14px", color: "white", margin: 0 }}>
              Build Successful
            </p>
            <p style={{ fontFamily: "system-ui", fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: "2px 0 0" }}>
              Deployed to production
            </p>
          </div>
        </div>
      </LiquidGlass>

      {/* Glass Music Player */}
      <LiquidGlass
        displacementScale={80}
        blurAmount={0.4}
        saturation={160}
        aberrationIntensity={4}
        elasticity={0.1}
        cornerRadius={24}
        mouseContainer={containerRef}
        style={{
          position: "absolute",
          top: "55%",
          left: "60%",
        }}
      >
        <div style={{ width: "240px", padding: "2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #ec4899, #f97316)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "system-ui", fontWeight: 600, fontSize: "14px", color: "white", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                Blinding Lights
              </p>
              <p style={{ fontFamily: "system-ui", fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: "2px 0 0" }}>
                The Weeknd
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "18px", cursor: "pointer" }}>◀</span>
              <span style={{ color: "white", fontSize: "22px", cursor: "pointer" }}>▶</span>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "18px", cursor: "pointer" }}>▶</span>
            </div>
          </div>
          <div style={{ marginTop: "12px", height: "3px", borderRadius: "2px", background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
            <div style={{ width: "35%", height: "100%", borderRadius: "2px", background: "linear-gradient(90deg, rgba(236,72,153,0.8), rgba(249,115,22,0.8))" }} />
          </div>
        </div>
      </LiquidGlass>

      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-30px, 20px) scale(1.05); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -25px) scale(1.08); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(-50%, 0) scale(1); }
          50% { transform: translate(calc(-50% + 15px), -20px) scale(1.1); }
        }
        a:hover {
          background: rgba(255,255,255,0.08) !important;
          color: rgba(255,255,255,0.95) !important;
          border-color: rgba(255,255,255,0.25) !important;
        }
      `}</style>
    </div>
  )
}
