import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { gsap } from "gsap";
import "./mbti-island.css";

const TOTAL_QUESTIONS = 56;
const fallbackState = { currentQuestion: 0, answers: Array(TOTAL_QUESTIONS).fill(null) };

function getAppState() {
  const app = window.PersonalityApp;
  return app && typeof app.getState === "function" ? app.getState() : fallbackState;
}

function MbtiNavigator() {
  const [state, setState] = useState(getAppState);
  const cellsRef = useRef([]);
  const gridRef = useRef(null);
  const currentQuestion = state.currentQuestion ?? 0;
  const answers = state.answers ?? fallbackState.answers;

  useEffect(() => {
    const updateState = (event) => setState(event.detail || getAppState());
    window.addEventListener("yuge:mbti-state-change", updateState);
    return () => window.removeEventListener("yuge:mbti-state-change", updateState);
  }, []);

  const resetCells = useCallback(() => gsap.to(cellsRef.current.filter(Boolean), { duration: .42, ease: "power3.out", overwrite: true, rotateX: 0, rotateY: 0, scale: 1 }), []);
  const tiltCells = useCallback((event) => {
    const grid = gridRef.current;
    if (!grid) return;
    const bounds = grid.getBoundingClientRect();
    const col = Math.floor(((event.clientX - bounds.left) / bounds.width) * 8);
    const row = Math.floor(((event.clientY - bounds.top) / bounds.height) * 7);
    cellsRef.current.forEach((cell, index) => {
      if (!cell) return;
      const influence = Math.max(0, 1 - Math.hypot(index % 8 - col, Math.floor(index / 8) - row) / 2.4);
      gsap.to(cell, { duration: .22, ease: "power3.out", overwrite: true, rotateX: -influence * 20, rotateY: influence * 18, scale: 1 + influence * .06 });
    });
  }, []);
  const selectQuestion = (index) => {
    setState({ ...state, currentQuestion: index });
    window.dispatchEvent(new CustomEvent("yuge:mbti-navigate", { detail: { index } }));
  };

  return <nav className="react-mbti-navigator" aria-label="MBTI 题目导航">
    <div className="react-mbti-navigator__header"><div><span>答题进度地图</span><strong>56 格人格坐标</strong></div><b>{answers.filter((item) => item !== null).length} / {TOTAL_QUESTIONS}</b></div>
    <div className="react-mbti-navigator__grid" onPointerLeave={resetCells} onPointerMove={tiltCells} ref={gridRef}>
      {Array.from({ length: TOTAL_QUESTIONS }, (_, index) => {
        const status = index === currentQuestion ? "current" : answers[index] === null ? "unanswered" : "answered";
        return <button aria-current={status === "current" ? "step" : undefined} aria-label={`第 ${index + 1} 题，${status === "current" ? "当前题目" : status === "answered" ? "已作答" : "未作答"}`} className={`react-mbti-cube react-mbti-cube--${status}`} key={index} onClick={() => selectQuestion(index)} ref={(node) => { cellsRef.current[index] = node; }} type="button"><span>{String(index + 1).padStart(2, "0")}</span></button>;
      })}
    </div>
    <div className="react-mbti-navigator__legend"><span><i className="is-current" />当前</span><span><i className="is-answered" />已答</span><span><i className="is-unanswered" />未答</span></div>
  </nav>;
}

const mountNode = document.getElementById("reactMbtiNavigator");
if (mountNode) {
  createRoot(mountNode).render(<MbtiNavigator />);
  window.__YugeMbtiNavigatorReady = true;
  window.dispatchEvent(new CustomEvent("yuge:mbti-react-ready"));
}
