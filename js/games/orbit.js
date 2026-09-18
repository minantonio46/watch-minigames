'use strict';

(function () {
  const canvas = $('#orbit-canvas');
  let ctx = null;

  let animFrame = null;
  let isRunning = false;
  let stageWidth = 0;
  let stageHeight = 0;
  let dpr = 1;

  // 게임 상태 변수
  let score = 0;
  let pointerAngle = 0;
  let angularSpeed = 2.4; // rad/s
  let direction = 1; // 1: 시계방향, -1: 반시계방향
  let targetAngle = 0;
  let targetSpan = Math.PI / 3; // 타겟 호 너비 (약 60도)
  let wasInTarget = false; // 타겟 구간 통과 감지용

  // 비주얼 이펙트 (파티클 & 링)
  let particles = [];
  let ringEffects = [];

  const TWO_PI = Math.PI * 2;

  function normalizeAngle(a) {
    a = a % TWO_PI;
    return a < 0 ? a + TWO_PI : a;
  }

  function getToleranceAngle() {
    if (stageWidth <= 0 || stageHeight <= 0) return 0.15;
    const radius = Math.min(stageWidth, stageHeight) * 0.40;
    const trackWidth = Math.max(7, Math.round(stageWidth * 0.048));
    const pointerRadius = trackWidth * 0.85;
    const capRadius = (trackWidth + 2) / 2;
    // 시각적 접촉 반경(포인터 구체 + 타겟 양끝 라운드 캡) + 사용자 체감용 널널한 보정치(trackWidth * 0.4)
    const marginPx = pointerRadius + capRadius + trackWidth * 0.4;
    return marginPx / radius;
  }

  function isAngleInArc(angle, center, span) {
    angle = normalizeAngle(angle);
    center = normalizeAngle(center);
    const halfSpan = span / 2 + getToleranceAngle();

    let diff = Math.abs(angle - center);
    if (diff > Math.PI) diff = TWO_PI - diff;
    return diff <= halfSpan;
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    dpr = window.devicePixelRatio || 1;
    stageWidth = rect.width;
    stageHeight = rect.height;

    canvas.width = Math.round(stageWidth * dpr);
    canvas.height = Math.round(stageHeight * dpr);

    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function init() {
    stop();
    resizeCanvas();
    score = 0;
    pointerAngle = -Math.PI / 2;
    direction = 1;
    angularSpeed = 2.4;
    targetAngle = Math.PI / 4;
    targetSpan = Math.PI / 3;
    wasInTarget = false;
    particles = [];
    ringEffects = [];

    setState('idle', tr('눌러서 시작', 'Tap to start'), tr('타겟에 왔을 때 터치!', 'Tap inside the target!'));
    drawScene();
  }

  let nextAngle = 0;
  let nextSpan = Math.PI * 0.42;

  function calcSpan(targetScore) {
    const t = Math.min(1, targetScore / 65);
    const startSpan = Math.PI * 0.44; // ~79도 (초반 넉넉함)
    const endSpan = Math.PI * 0.08;   // ~14.4도 (후반 익스트림 칼타이밍)
    return startSpan - Math.pow(t, 0.85) * (startSpan - endSpan);
  }

  function calcSpeed(currentScore) {
    // 0~15점: 완만하게 웜업 (2.2 -> 3.1 rad/s)
    // 16점~65점+: 본격적인 광속 가속 (최대 8.8 rad/s의 초고속 스릴)
    if (currentScore <= 15) {
      return 2.2 + currentScore * 0.06;
    }
    return Math.min(8.8, 3.1 + (currentScore - 15) * 0.115);
  }

  function calcForwardAngle(baseAngle, dir) {
    const minOffset = Math.PI * 0.55; // 약 100도 전방
    const maxOffset = Math.PI * 1.05; // 약 190도 전방
    const forwardOffset = minOffset + Math.random() * (maxOffset - minOffset);
    return normalizeAngle(baseAngle + dir * forwardOffset);
  }

  function start() {
    score = 0;
    pointerAngle = -Math.PI / 2;
    direction = 1; // 12시에서 시계방향으로 시작
    angularSpeed = 2.2;
    wasInTarget = false;
    particles = [];
    ringEffects = [];

    // 현재 타겟과 다음 타겟(미리보기) 동시 준비
    targetSpan = calcSpan(0);
    targetAngle = calcForwardAngle(pointerAngle, direction);

    // 다음 타겟: 첫 타겟 적중 시 반전될 방향(-direction) 기준 전방에 미리 배치
    nextSpan = calcSpan(1);
    nextAngle = calcForwardAngle(targetAngle, -direction);

    isRunning = true;
    setState('playing', '', tr('점수: 0', 'Score: 0'));
    loop(performance.now());
  }

  function onAction() {
    if (state === 'idle') {
      start();
      return;
    }

    if (state !== 'playing') return;

    const hit = isAngleInArc(pointerAngle, targetAngle, targetSpan);

    if (hit) {
      // 1. 적중 성공!
      score++;
      navigator.vibrate?.(25);

      // 충격파 및 스파크 파티클 생성
      createHitEffect(targetAngle);

      // [규칙 통일] 성공할 때마다 100% 무조건 반대 방향으로 회전!
      direction = -direction;

      // [익스트림 난이도 가속] 초반 웜업 후 후반부 최대 8.8 rad/s까지 광속 가속!
      angularSpeed = calcSpeed(score);

      $('#message').textContent = tr(`적중! ${score}점`, `HIT! ${score}`);

      // [흐릿하게 대기 중이던 다음 타겟을 활성 타겟으로 즉시 승격]
      targetAngle = nextAngle;
      targetSpan = nextSpan;
      wasInTarget = false;

      // 그 다음번 타겟(다다음 턴에 도달할 곳)을 미리 계산하여 흐릿하게 대기
      nextSpan = calcSpan(score + 1);
      nextAngle = calcForwardAngle(targetAngle, -direction);
    } else {
      // 2. 빗맞음 (타겟 밖에서 탭)
      gameOver(false);
    }
  }

  function createHitEffect(angle) {
    const cx = stageWidth / 2;
    const cy = stageHeight / 2;
    const radius = Math.min(stageWidth, stageHeight) * 0.40;
    const hitX = cx + Math.cos(angle) * radius;
    const hitY = cy + Math.sin(angle) * radius;

    // 파티클 생성
    const particleCount = 14;
    for (let i = 0; i < particleCount; i++) {
      const pAngle = Math.random() * TWO_PI;
      const speed = 40 + Math.random() * 90;
      particles.push({
        x: hitX,
        y: hitY,
        vx: Math.cos(pAngle) * speed,
        vy: Math.sin(pAngle) * speed,
        size: 2 + Math.random() * 2.5,
        alpha: 1.0,
        life: 0.45
      });
    }

    // 원형 충격파 링
    ringEffects.push({
      x: hitX,
      y: hitY,
      radius: 6,
      maxRadius: radius * 0.35,
      alpha: 1.0
    });
  }

  function gameOver(isPassed = false) {
    isRunning = false;
    navigator.vibrate?.([60, 40, 100]);

    const finalScore = score;
    const isNew = saveBest('orbit', finalScore);
    showBest('orbit');

    const msg = isNew
      ? tr(`최고 기록! ${finalScore}점`, `New Record! ${finalScore} pts`)
      : (isPassed ? tr('타겟을 놓쳤어요!', 'Target missed!') : tr('빗맞았어요!', 'Off target!'));

    setState('idle', tr('다시 시작', 'Try again'), msg);
    drawScene();
  }

  let lastTime = 0;
  function loop(currentTime) {
    if (!isRunning) return;

    if (!lastTime) lastTime = currentTime;
    const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
    lastTime = currentTime;

    // 포인터 회전 업데이트
    pointerAngle = normalizeAngle(pointerAngle + direction * angularSpeed * dt);

    // 타겟 통과/지나침 판정
    const inTarget = isAngleInArc(pointerAngle, targetAngle, targetSpan);
    if (inTarget) {
      wasInTarget = true;
    } else if (wasInTarget) {
      // 타겟 구간에 진입했다가 탭하지 않고 그대로 지나쳐버림!
      gameOver(true);
      drawScene();
      return;
    }

    // 파티클 업데이트
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt / p.life;
      if (p.alpha <= 0) particles.splice(i, 1);
    }

    // 링 이펙트 업데이트
    for (let i = ringEffects.length - 1; i >= 0; i--) {
      const r = ringEffects[i];
      r.radius += (r.maxRadius - r.radius) * 12 * dt;
      r.alpha -= dt * 2.5;
      if (r.alpha <= 0) ringEffects.splice(i, 1);
    }

    drawScene();
    animFrame = requestAnimationFrame(loop);
  }

  function drawScene() {
    if (!ctx) return;
    ctx.clearRect(0, 0, stageWidth, stageHeight);

    const cx = stageWidth / 2;
    const cy = stageHeight / 2;
    const radius = Math.min(stageWidth, stageHeight) * 0.40;
    const trackWidth = Math.max(7, Math.round(stageWidth * 0.048));

    const isLight = document.documentElement.dataset.theme === 'light';
    const isContrast = document.documentElement.dataset.theme === 'contrast';

    const targetColor = isContrast
      ? '#00ff66'
      : (isLight ? '#15803d' : '#34d399');

    // 1. 배경 가이드 링 (Track)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, TWO_PI);
    ctx.strokeStyle = isContrast
      ? '#262626'
      : (isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.10)');
    ctx.lineWidth = trackWidth;
    ctx.stroke();

    // 2. 다음 타겟 아크 미리보기 (Next Target Preview - 동일한 색상의 둥근 점선 테두리)
    if (isRunning) {
      const nextStart = nextAngle - nextSpan / 2;
      const nextEnd = nextAngle + nextSpan / 2;

      const pad = 1.5;
      const rCap = trackWidth / 2 + pad;
      const outerR = radius + rCap;
      const innerR = Math.max(0, radius - rCap);

      const endCx = cx + Math.cos(nextEnd) * radius;
      const endCy = cy + Math.sin(nextEnd) * radius;
      const startCx = cx + Math.cos(nextStart) * radius;
      const startCy = cy + Math.sin(nextStart) * radius;

      ctx.save();
      ctx.beginPath();
      // 1) 외곽 호 (시작 -> 끝)
      ctx.arc(cx, cy, outerR, nextStart, nextEnd, false);
      // 2) 끝 지점 둥근 반원 마감
      ctx.arc(endCx, endCy, rCap, nextEnd, nextEnd + Math.PI, false);
      // 3) 내곽 호 (끝 -> 시작)
      ctx.arc(cx, cy, innerR, nextEnd, nextStart, true);
      // 4) 시작 지점 둥근 반원 마감
      ctx.arc(startCx, startCy, rCap, nextStart + Math.PI, nextStart + Math.PI * 2, false);
      ctx.closePath();

      ctx.strokeStyle = targetColor; // 현재 타겟과 동일한 색상으로 통일!
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]); // 세련된 테두리 점선
      ctx.stroke();
      ctx.restore();
    }

    // 3. 현재 타겟 아크 (Active Target Arc - 선명한 실선)
    const targetStart = targetAngle - targetSpan / 2;
    const targetEnd = targetAngle + targetSpan / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, targetStart, targetEnd);
    ctx.strokeStyle = targetColor;
    ctx.lineWidth = trackWidth + 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // 3. 중앙 대형 점수 표시 (게임 중 및 종료 후 최종 점수 유지)
    if (isRunning || score > 0) {
      ctx.fillStyle = isContrast
        ? '#00f0ff'
        : (isLight ? '#12243a' : '#f1f5fc');
      ctx.font = `bold ${Math.round(stageWidth * 0.30)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(score), cx, cy);
    }

    // 4. 충격파 링 이펙트
    for (let i = 0; i < ringEffects.length; i++) {
      const r = ringEffects[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, r.alpha);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, TWO_PI);
      ctx.strokeStyle = targetColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // 5. 파티클 이펙트
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = targetColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }

    // 6. 회전하는 포인터 (Orbiter)
    const px = cx + Math.cos(pointerAngle) * radius;
    const py = cy + Math.sin(pointerAngle) * radius;
    const pointerRadius = trackWidth * 0.85;

    // 포인터 외부 글로우 / 링
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, pointerRadius + 3, 0, TWO_PI);
    ctx.fillStyle = isContrast
      ? 'rgba(0, 240, 255, 0.4)'
      : (isLight ? 'rgba(23, 101, 182, 0.3)' : 'rgba(138, 199, 255, 0.4)');
    ctx.fill();

    // 포인터 본체
    ctx.beginPath();
    ctx.arc(px, py, pointerRadius, 0, TWO_PI);
    ctx.fillStyle = isContrast
      ? '#00f0ff'
      : (isLight ? '#1765b6' : '#ffffff');
    ctx.fill();
    ctx.restore();
  }

  function stop() {
    isRunning = false;
    if (animFrame !== null) {
      cancelAnimationFrame(animFrame);
      animFrame = null;
    }
    lastTime = 0;
  }

  function onCancel() {
    stop();
  }

  function onResize() {
    resizeCanvas();
    drawScene();
  }

  function onVisibilityChange(hidden) {
    if (hidden && state === 'playing') {
      gameOver(false);
    }
  }

  registerGame('orbit', {
    init,
    onAction,
    onCancel,
    onResize,
    onVisibilityChange
  });
})();
