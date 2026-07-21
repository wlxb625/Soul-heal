import { useCallback, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";

const TOTAL_QUESTIONS = 56;
const OPTIONS = ["非常同意", "比较同意", "中立", "比较不同意", "非常不同意"];
const PREVIEW_QUESTIONS = [
  "我倾向于从与人互动中获得能量。",
  "我会先关注事实和已经发生的细节。",
  "做决定时，我更看重逻辑是否自洽。",
  "我喜欢提前规划并按计划推进。"
];

function getQuestionLabel(index) {
  return PREVIEW_QUESTIONS[index % PREVIEW_QUESTIONS.length];
}

function QuestionCubeMap({ answers, currentQuestion, onSelect }) {
  const mapRef = useRef(null);
  const cellsRef = useRef([]);
  const resetCells = useCallback(() => {
    gsap.to(cellsRef.current.filter(Boolean), {
      rotateX: 0,
      rotateY: 0,
      scale: 1,
      duration: 0.45,
      ease: "power3.out",
      overwrite: true
    });
  }, []);

  const handlePointerMove = useCallback((event) => {
    const map = mapRef.current;
    if (!map) return;
    const rect = map.getBoundingClientRect();
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * 8);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * 7);

    cellsRef.current.forEach((cell, index) => {
      if (!cell) return;
      const distance = Math.hypot(index % 8 - col, Math.floor(index / 8) - row);
      const influence = Math.max(0, 1 - distance / 2.6);
      gsap.to(cell, {
        rotateX: -influence * 26,
        rotateY: influence * 22,
        scale: 1 + influence * 0.08,
        duration: 0.22,
        ease: "power3.out",
        overwrite: true
      });
    });
  }, []);

  return (
    <nav className="question-map" aria-label="MBTI 题目导航">
      <div className="question-map__heading">
        <div>
          <p className="eyebrow">答题进度地图</p>
          <h2>56 格人格坐标</h2>
        </div>
        <span>{answers.filter((answer) => answer !== null).length} / {TOTAL_QUESTIONS}</span>
      </div>
      <div
        className="question-map__grid"
        ref={mapRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={resetCells}
      >
        {Array.from({ length: TOTAL_QUESTIONS }, (_, index) => {
          const status = index === currentQuestion ? "current" : answers[index] === null ? "unanswered" : "answered";
          return (
            <button
              aria-current={index === currentQuestion ? "step" : undefined}
              aria-label={`第 ${index + 1} 题，${status === "answered" ? "已作答" : status === "current" ? "当前题目" : "未作答"}`}
              className={`question-cube question-cube--${status}`}
              key={index}
              onClick={() => onSelect(index)}
              ref={(node) => { cellsRef.current[index] = node; }}
              type="button"
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
            </button>
          );
        })}
      </div>
      <div className="question-map__legend" aria-label="题目状态说明">
        <span><i className="legend-current" />当前</span>
        <span><i className="legend-answered" />已答</span>
        <span><i className="legend-unanswered" />未答</span>
      </div>
    </nav>
  );
}

export default function App() {
  const [answers, setAnswers] = useState(() => Array(TOTAL_QUESTIONS).fill(null));
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const questionText = useMemo(() => getQuestionLabel(currentQuestion), [currentQuestion]);

  const answerCurrentQuestion = (value) => {
    setAnswers((previous) => previous.map((answer, index) => index === currentQuestion ? value : answer));
  };

  return (
    <main className="mbti-prototype-shell">
      <section className="mbti-prototype-card">
        <header className="prototype-header">
          <p className="eyebrow">React UI foundation · local prototype</p>
          <h1>MBTI 人格探索</h1>
          <p>React 负责界面状态与交互；下一步会接入现有题库、登录状态和自动保存接口。</p>
        </header>

        <section className="question-card" aria-labelledby="question-title">
          <div className="question-card__meta">第 {currentQuestion + 1} 题 / 共 {TOTAL_QUESTIONS} 题</div>
          <h2 id="question-title">{questionText}</h2>
          <div className="answer-options" role="group" aria-label="选择你的倾向">
            {OPTIONS.map((option, index) => (
              <button
                className={answers[currentQuestion] === index ? "answer-option is-selected" : "answer-option"}
                key={option}
                onClick={() => answerCurrentQuestion(index)}
                type="button"
              >
                <b>{index + 1}</b>{option}
              </button>
            ))}
          </div>
          <div className="question-actions">
            <button disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((index) => index - 1)} type="button">上一题</button>
            <button disabled={currentQuestion === TOTAL_QUESTIONS - 1} onClick={() => setCurrentQuestion((index) => index + 1)} type="button">下一题</button>
          </div>
        </section>

        <QuestionCubeMap answers={answers} currentQuestion={currentQuestion} onSelect={setCurrentQuestion} />
      </section>
    </main>
  );
}
