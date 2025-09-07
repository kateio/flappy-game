"use client";
import { useEffect, useRef, useState } from "react";

/** Flappy-like: кликай/тапай или жми Space/↑ чтобы подпрыгнуть. R — рестарт. */

type Pipe = { x: number; gapY: number; passed: boolean };
type Cloud = { x: number; y: number; scale: number; speed: number };

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [score, setScore] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const stateRef = useRef({
    birdY: 0,
    birdV: 0,
    pipes: [] as Pipe[],
    time: 0,
    best: 0,
    lastGapY: null as number | null,
    score: 0,
    clouds: [] as Cloud[],
  });

  // параметры игры
  const G = 1700; // гравитация
  const FLAP = -430; // сила прыжка
  const BIRD_X = 120; // фиксированный X
  const BIRD_R = 16; // радиус птички
  const PIPE_W = 70; // ширина трубы
  const GAP = 160; // зазор
  const PIPE_SPEED = 180; // скорость движения труб
  const PIPE_SPAWN = 1400; // спавн труб каждые мс

  useEffect(() => {
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext("2d")!;

    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 500);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // адаптация под экран
    function resize() {
      const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      const isMobileNow = window.innerWidth <= 500;
      const w = isMobileNow ? Math.floor(window.innerWidth) : Math.floor(window.innerWidth * 0.5);
      const h = Math.floor(window.innerHeight);
      cvs.style.width = w + "px";
      cvs.style.height = h + "px";
      cvs.width = w * DPR;
      cvs.height = h * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      // пересчитать облака под новый размер
      initClouds(w, h);
    }
    resize();
    window.addEventListener("resize", resize);

    if (!initializedRef.current) {
      const best = Number(localStorage.getItem("flappy_best") || 0);
      stateRef.current.best = best;
      reset(false, false);
      initializedRef.current = true;
    }

    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      if (running) update(dt);
      render();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    // управление
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      } else if (e.code === "KeyR") {
        if (started) reset(true);
      }
    };
    const onClick = () => flap();
    window.addEventListener("keydown", onKey);
    cvs.addEventListener("pointerdown", onClick);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("keydown", onKey);
      cvs.removeEventListener("pointerdown", onClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    // вспомогательные функции
    function flap() {
      if (!running) {
        // Разрешаем клик/Space перезапускать игру только после первого старта
        if (started) {
          reset(true);
        }
        return;
      }
      stateRef.current.birdV = FLAP;
    }

    function reset(centerBird: boolean, startRunning: boolean = true) {
      if (startRunning) setRunning(true);
      setScore(0);
      stateRef.current.score = 0;
      stateRef.current.pipes = [];
      stateRef.current.time = 0;
      stateRef.current.birdV = 0;
      const h = cvs.height / (window.devicePixelRatio || 1);
      stateRef.current.birdY = h * (centerBird ? 0.45 : 0.5);
      stateRef.current.lastGapY = h * 0.5;
      const w = cvs.width / (window.devicePixelRatio || 1);
      initClouds(w, h);
    }

    function spawnPipe(width: number, height: number) {
      const margin = 40;
      const minY = margin + GAP / 2;
      const maxY = height - 40 - GAP / 2;
      const randomY = minY + Math.random() * (maxY - minY);

      const maxStep = 180; // максимальный сдвиг отверстия между соседними трубами по вертикали
      const last = stateRef.current.lastGapY ?? randomY;
      const unclamped = randomY;
      const clamped = Math.max(last - maxStep, Math.min(last + maxStep, unclamped));
      const gapY = Math.max(minY, Math.min(maxY, clamped));

      stateRef.current.lastGapY = gapY;
      stateRef.current.pipes.push({ x: width + 60, gapY, passed: false });
    }

    function initClouds(width: number, height: number) {
      const clouds: Cloud[] = [];
      const count = Math.max(6, Math.floor(width / 120));
      for (let i = 0; i < count; i++) {
        const scale = (0.6 + Math.random() * 1.4) * 2; // увеличить облака в 2 раза
        const minY = 40;
        const maxY = Math.max(minY, height - 100 - 22 * scale);
        const y = minY + Math.random() * Math.max(0, maxY - minY);
        const speed = 12 + Math.random() * 24; // медленное движение для параллакса
        const x = Math.random() * width;
        clouds.push({ x, y, scale, speed });
      }
      stateRef.current.clouds = clouds;
    }

    function update(dt: number) {
      const width = cvs.width / (window.devicePixelRatio || 1);
      const height = cvs.height / (window.devicePixelRatio || 1);

      // спавн труб
      stateRef.current.time += dt * 1000;
      if (stateRef.current.time > PIPE_SPAWN) {
        stateRef.current.time = 0;
        spawnPipe(width, height);
      }

      // физика птички
      stateRef.current.birdV += G * dt;
      stateRef.current.birdY += stateRef.current.birdV * dt;

      // движение труб
      for (const p of stateRef.current.pipes) p.x -= PIPE_SPEED * dt;

      // движение облаков (медленнее труб)
      for (const c of stateRef.current.clouds) {
        c.x -= c.speed * dt;
      }
      for (const c of stateRef.current.clouds) {
        if (c.x < -160 * c.scale) {
          c.x = width + 40;
          // слегка рандомизируем высоту при респавне
          // подбираем высоту так, чтобы перекрытие было максимум с одним облаком
          let attempts = 0;
          const maxAttempts = 8;
          const minY = 40;
          const maxY = Math.max(minY, height - 100 - 22 * c.scale);
          let chosenY = minY + Math.random() * Math.max(0, maxY - minY);
          while (attempts < maxAttempts) {
            const bounds = getCloudBounds(c.x, chosenY, c.scale);
            let overlapCount = 0;
            for (const other of stateRef.current.clouds) {
              if (other === c) continue;
              const ob = getCloudBounds(other.x, other.y, other.scale);
              if (rectsOverlap(bounds, ob)) overlapCount++;
              if (overlapCount > 1) break;
            }
            if (overlapCount <= 1) break;
            attempts++;
            chosenY = minY + Math.random() * Math.max(0, maxY - minY);
          }
          c.y = chosenY;
        }
      }

      // убрать ушедшие трубы
      stateRef.current.pipes = stateRef.current.pipes.filter((p) => p.x > -PIPE_W - 10);

      // подсчёт очков
      for (const p of stateRef.current.pipes) {
        if (!p.passed && p.x + PIPE_W < BIRD_X) {
          p.passed = true;
          setScore((s) => {
            const ns = s + 1;
            stateRef.current.score = ns;
            return ns;
          });
        }
      }

      // столкновения
      const y = stateRef.current.birdY;
      if (y - BIRD_R < 0 || y + BIRD_R > height - 40) {
        setRunning(false);
        // Обновляем best только по окончании игры
        const currentScore = stateRef.current.score;
        if (currentScore > stateRef.current.best) {
          stateRef.current.best = currentScore;
          localStorage.setItem("flappy_best", String(currentScore));
        }
        return;
      }
      for (const p of stateRef.current.pipes) {
        const inX = BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W;
        const inY =
          y - BIRD_R > p.gapY - GAP / 2 && y + BIRD_R < p.gapY + GAP / 2;
        if (inX && !inY) {
          setRunning(false);
          const currentScore = stateRef.current.score;
          if (currentScore > stateRef.current.best) {
            stateRef.current.best = currentScore;
            localStorage.setItem("flappy_best", String(currentScore));
          }
          return;
        }
      }
    }

    function render() {
      const width = cvs.width / (window.devicePixelRatio || 1);
      const height = cvs.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, width, height);

      // фон
      ctx.fillStyle = "#ecf2ff";
      ctx.fillRect(0, 0, width, height);

      // земля
      ctx.fillStyle = "#cfd8dc";
      ctx.fillRect(0, height - 40, width, 40);

      // облака (под трубами). Если перекрываются, верхнему добавляем лёгкую тень цвета неба
      const cloudBoundsList: { l: number; t: number; r: number; b: number }[] = [];
      for (let i = 0; i < stateRef.current.clouds.length; i++) {
        const c = stateRef.current.clouds[i];
        const bounds = getCloudBounds(c.x, c.y, c.scale);
        let overlaps = false;
        for (let j = 0; j < i; j++) {
          const prev = cloudBoundsList[j];
          if (rectsOverlap(bounds, prev)) {
            overlaps = true;
            break;
          }
        }
        drawCloud(ctx, c.x, c.y, c.scale, overlaps);
        cloudBoundsList.push(bounds);
      }

      // трубы (зелёные поверх облаков) со скруглением 2px
      for (const p of stateRef.current.pipes) {
        ctx.fillStyle = "#4caf50";
        drawRoundedRect(ctx, p.x, 0, PIPE_W, p.gapY - GAP / 2, 2);
        drawRoundedRect(
          ctx,
          p.x,
          p.gapY + GAP / 2,
          PIPE_W,
          height - (p.gapY + GAP / 2) - 40,
          2
        );
      }

      // птичка
      const y = stateRef.current.birdY;
      const isOnFire = stateRef.current.score > stateRef.current.best;
      ctx.beginPath();
      ctx.arc(BIRD_X, y, BIRD_R, 0, Math.PI * 2);
      ctx.fillStyle = "#ffca28";
      ctx.fill();
      // если игра идёт — рисуем шляпу-котелок поверх головы
      if (isOnFire) {
        drawBowlerHat(ctx, BIRD_X, y, BIRD_R);
      }
      // клюв (отзеркаленный по горизонтали базой к птичке, поменьше)
      ctx.beginPath();
      const beakLen = 8;
      const beakHalf = 4;
      ctx.moveTo(BIRD_X + BIRD_R, y - beakHalf);
      ctx.lineTo(BIRD_X + BIRD_R, y + beakHalf);
      ctx.lineTo(BIRD_X + BIRD_R + beakLen, y);
      ctx.closePath();
      ctx.fillStyle = "#ff9800";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(BIRD_X + 6, y - 4, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#263238";
      ctx.fill();

      // счёт
      ctx.fillStyle = "#263238";
      ctx.font = "bold 18px ui-sans-serif, system-ui, -apple-system";
      const isOnFireScore = stateRef.current.score > stateRef.current.best;
      ctx.fillText(`Score: ${stateRef.current.score}${isOnFireScore ? " 🔥" : ""}`, 12, 24);
      ctx.fillText(`Best: ${stateRef.current.best}`, 12, 44);

      // оверлей Game Over теперь вне canvas
    }
  }, [running, started]); // eslint-disable-line

  function drawCloud(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    withShadow: boolean = false
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (withShadow) {
      ctx.shadowColor = "#ecf2ff"; // цвет неба
      ctx.shadowBlur = 20  // более явный блюр
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 3;
    }
    ctx.fillStyle = "#ffffff";
    // базовая «пухлая» форма из кругов
    const circles = [
      { dx: 0, dy: 0, r: 16 },
      { dx: 18, dy: -6, r: 18 },
      { dx: 36, dy: 0, r: 16 },
      { dx: 10, dy: 6, r: 14 },
      { dx: 26, dy: 8, r: 14 },
    ];
    ctx.beginPath();
    for (const c of circles) {
      ctx.moveTo(c.dx + c.r, c.dy);
      ctx.arc(c.dx, c.dy, c.r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  // Шляпа-котелок, слегка перекрывающая голову птички
  function drawBowlerHat(
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    birdRadius: number
  ) {
    // Параметры шляпы относительно размера головы
    const brimWidth = birdRadius * 2.4 * 0.7; // увеличил поля
    const brimHeight = 5;
    const domeScaleX = 1.08; // слегка уже по X
    const domeScaleY = 1.4; // в 2 раза выше по Y
    const domeRadius = birdRadius * 0.5; // купол пропорционально больше

    // Поля (полностью оранжевые), слегка перекрывают голову
    ctx.fillStyle = "#ff9800";
    drawRoundedRect(
      ctx,
      centerX - brimWidth / 2,
      centerY - birdRadius - brimHeight * 0.6 + 4,
      brimWidth,
      brimHeight,
      6
    );

    // Купол (оранжевый) — полукруглая форма
    ctx.save();
    ctx.translate(centerX, centerY - birdRadius + 4);
    ctx.scale(domeScaleX, domeScaleY);
    ctx.beginPath();
    ctx.arc(0, 0, domeRadius, Math.PI, 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = "#ff9800";
    ctx.fill();
    ctx.restore();
  }

  function getCloudBounds(x: number, y: number, scale: number) {
    // аппроксимация габаритов облака из drawCloud()
    const left = x + (-16) * scale;
    const right = x + 52 * scale;
    const top = y + (-24) * scale;
    const bottom = y + 22 * scale;
    return { l: left, t: top, r: right, b: bottom };
  }

  function rectsOverlap(a: { l: number; t: number; r: number; b: number }, b: { l: number; t: number; r: number; b: number }) {
    return !(a.r < b.l || a.l > b.r || a.b < b.t || a.t > b.b);
  }

  function drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  // Инициализация состояния и запуск игры по кнопке Start
  function startNewGame(centerBird: boolean = true) {
    const cvs = canvasRef.current;
    if (!cvs) return;
    setStarted(true);
    setScore(0);
    stateRef.current.score = 0; // сбрасываем score в stateRef
    stateRef.current.pipes = [];
    stateRef.current.time = 0;
    stateRef.current.birdV = 0;
    const h = cvs.height / (window.devicePixelRatio || 1);
    stateRef.current.birdY = h * (centerBird ? 0.45 : 0.5);
    setRunning(true);
  }

  return (
    <div style={{ 
      display: "flex", 
      width: "100vw", 
      height: "100vh", 
      margin: 0, 
      padding: 0, 
      overflow: "hidden",
      boxSizing: "border-box"
    }}>
      {/* Desktop left panel - hidden on mobile */}
      {!isMobile && (
        <div
          style={{
            width: "50vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            flexShrink: 0,
            boxSizing: "border-box",
          }}
        >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 12 }}>Bird 🐤</h1>
          <div style={{ fontSize: 16, opacity: 0.85 }}>
            Controls: <b>Space / ↑</b> or <b>click/tap</b>.<br />
            Restart with the <b>Restart</b> button. High score is saved locally.
          </div>
        </div>
        </div>
      )}
      
      {/* Game area */}
      <div style={{ 
        width: isMobile ? "100vw" : "50vw", 
        height: "100vh", 
        position: "relative", 
        flexShrink: 0,
        boxSizing: "border-box",
      }}>
        {/* Mobile title/description - only shown before game starts */}
        {/*
        {!started && isMobile && (
          <div style={{
            position: "absolute",
            inset: 0,
            // background: "rgba(0,0,0,0.55)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: 20,
          }}>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: "#fff" }}>Bird 🐤</h1>
            <div style={{ fontSize: 14, opacity: 0.9, color: "#fff" }}>
              Controls: <b>Space / ↑</b> or <b>click/tap</b>.<br />
              Restart with the <b>Restart</b> button.
            </div>
            {/*
            <button
              onClick={() => startNewGame(true)}
              style={{
                padding: "10px 18px",
                fontSize: 16,
                fontWeight: 700,
                background: "#fff",
                color: "#000",
                border: "none",
                borderRadius: 60,
                cursor: "pointer",
              }}
            >
              Start
            </button>
            

          </div>
          
        )} */}
        
        <canvas ref={canvasRef} />
        {/* Overlay for both start and game over */}
        {(!started || (started && !running)) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {started && !running && (
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 32, textAlign: "center" }}>
                Game Over
                <div style={{ fontSize: 16, fontWeight: 400, marginTop: 8 }}>
                  You scored {stateRef.current.score} points
                </div>
              </div>
            )}
            <button
              onClick={() => startNewGame(true)}
              style={{
                padding: "10px 18px",
                fontSize: 16,
                fontWeight: 700,
                background: "#fff",
                color: "#000",
                border: "none",
                borderRadius: 60,
                cursor: "pointer",
              }}
            >
              {started ? "Restart" : "Start"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
