import { useCallback, useEffect, useRef } from "react";
import "./BorderGlow.css";

function parseHSL(value) {
  const match = String(value).match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  return match ? { h: match[1], s: match[2], l: match[3] } : { h: 40, s: 80, l: 80 };
}

function glowVariables(glowColor, intensity) {
  const { h, s, l } = parseHSL(glowColor);
  return [100, 60, 40, 22].reduce((variables, opacity, index) => {
    variables[`--border-glow-${index}`] = `hsl(${h}deg ${s}% ${l}% / ${Math.min(opacity * intensity, 100)}%)`;
    return variables;
  }, {});
}

function BorderGlow({
  children,
  className = "",
  edgeSensitivity = 30,
  glowColor = "42 62 58",
  backgroundColor = "rgba(255,253,247,.76)",
  borderRadius = 20,
  glowRadius = 26,
  glowIntensity = 0.8,
  animated = false,
  colors = ["#e3bd72", "#9ed9c5", "#81b3cd"],
  fillOpacity = 0.22
}) {
  const cardRef = useRef(null);
  const handlePointerMove = useCallback((event) => {
    const card = cardRef.current;
    if (!card || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const edge = Math.min(x, y, rect.width - x, rect.height - y);
    const proximity = Math.max(0, Math.min(1, 1 - edge / Math.min(rect.width, rect.height, 140)));
    const angle = Math.atan2(y - rect.height / 2, x - rect.width / 2) * 180 / Math.PI + 90;
    card.style.setProperty("--border-glow-proximity", proximity.toFixed(3));
    card.style.setProperty("--border-glow-angle", `${angle.toFixed(1)}deg`);
  }, []);

  useEffect(() => {
    if (!animated || !cardRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const card = cardRef.current;
    card.classList.add("border-glow-card--sweep");
    const timer = window.setTimeout(() => card.classList.remove("border-glow-card--sweep"), 1700);
    return () => window.clearTimeout(timer);
  }, [animated]);

  return <div ref={cardRef} onPointerMove={handlePointerMove} className={`border-glow-card ${className}`} style={{
    "--border-glow-threshold": edgeSensitivity / 100,
    "--border-glow-radius": `${borderRadius}px`,
    "--border-glow-padding": `${glowRadius}px`,
    "--border-glow-fill": fillOpacity,
    "--border-glow-a": colors[0],
    "--border-glow-b": colors[1] || colors[0],
    "--border-glow-c": colors[2] || colors[0],
    "--border-glow-bg": backgroundColor,
    ...glowVariables(glowColor, glowIntensity)
  }}>
    <span className="border-glow-card__edge" aria-hidden="true" />
    <div className="border-glow-card__inner">{children}</div>
  </div>;
}

export default BorderGlow;
