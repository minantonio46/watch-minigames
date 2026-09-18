'use strict';

(function () {
  const canvas = $('#stack-canvas');
  let ctx = null;

  let animFrame = null;
  let isRunning = false;
  let stageWidth = 0;
  let stageHeight = 0;
  let dpr = 1;

  // 게임 상태 변수
  let score = 0;
  let combo = 0;
  let recoveryCount = 0;
  let comboThreshold = 3;
  let blockHeight = 24;
  let baseWidth = 140;
  let currentWidth = 140;

  // 블록 목록 (아래부터 위로)
  let blocks = [];
  // 현재 움직이는 블록
  let activeBlock = null;
  // 잘려나간 파편 애니메이션
  let debrisList = [];
  // 퍼펙트 이펙트
  let flashEffects = [];

  // 카메라 스크롤
  let cameraY = 0;
  let targetCameraY = 0;

  // 색상 팔레트 생성 (층수에 따른 무지개 그라데이션)
  function getBlockColor(floor, isDebris = false) {
    const isContrast = document.documentElement.dataset.theme === 'contrast';
    const isLight = document.documentElement.dataset.theme === 'light';

    if (isContrast) {
      if (floor % 2 === 0) return '#00f0ff';
      return '#00ff66';
    }

    const hue = (floor * 14 + 195) % 360;
    const sat = isLight ? 75 : 85;
    const light = isLight ? (isDebris ? 50 : 58) : (isDebris ? 45 : 55);
    return `hsl(${hue}, ${sat}%, ${light}%)`;
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

    blockHeight = Math.max(18, Math.round(stageHeight * 0.085));
    baseWidth = Math.round(stageWidth * 0.62);
  }

  function init() {
    stop();
    resizeCanvas();
    score = 0;
    combo = 0;
    recoveryCount = 0;
    comboThreshold = 3;
    currentWidth = baseWidth;
    blocks = [];
    debrisList = [];
    flashEffects = [];
    cameraY = 0;
    targetCameraY = 0;

    // 바닥 기본 블록 배치
    const initialY = stageHeight - blockHeight * 2;
    const baseBlock = {
      x: (stageWidth - baseWidth) / 2,
      y: initialY,
      width: baseWidth,
      height: blockHeight,
      color: getBlockColor(0)
    };
    blocks.push(baseBlock);
    activeBlock = null;

    setState('idle', tr('눌러서 시작', 'Tap to start'), tr('타이밍 맞춰 층 쌓기!', 'Stack blocks on time!'));
    drawScene();
  }

  function start() {
    score = 0;
    combo = 0;
    recoveryCount = 0;
    comboThreshold = 3;
    currentWidth = baseWidth;
    blocks = [];
    debrisList = [];
    flashEffects = [];
    cameraY = 0;
    targetCameraY = 0;

    const initialY = stageHeight - blockHeight * 2;
    blocks.push({
      x: (stageWidth - baseWidth) / 2,
      y: initialY,
      width: baseWidth,
      height: blockHeight,
      color: getBlockColor(0)
    });

    spawnNextBlock();
    isRunning = true;
    setState('playing', '', tr('층수: 1', 'Floor: 1'));
    loop(performance.now());
  }

  const TRAVEL_TIME = 0.75; // 스폰 후 아래층 도달까지 항상 750ms 일정

  function spawnNextBlock() {
    const nextFloor = blocks.length;
    const prevBlock = blocks[blocks.length - 1];
    const y = prevBlock.y - blockHeight;

    // 좌우 번갈아 가며 스폰
    const fromLeft = nextFloor % 2 === 1;
    const targetX = prevBlock.x;
    const travelDistance = Math.round(stageWidth * 0.58);
    const speedMagnitude = travelDistance / TRAVEL_TIME;
    const speed = speedMagnitude * (fromLeft ? 1 : -1);

    activeBlock = {
      x: fromLeft ? targetX - travelDistance : targetX + travelDistance,
      y: y,
      width: currentWidth,
      height: blockHeight,
      speed: speed,
      direction: fromLeft ? 1 : -1,
      minX: targetX - travelDistance,
      maxX: targetX + travelDistance,
      targetX: targetX,
      color: getBlockColor(nextFloor)
    };

    // 타워가 화면 중간 위로 올라가면 카메라 스크롤 목표값 갱신
    const visibleFloorY = y - cameraY;
    const idealY = stageHeight * 0.52;
    if (visibleFloorY < idealY) {
      targetCameraY = y - idealY;
    }
  }

  function onAction() {
    if (state === 'idle') {
      start();
      return;
    }

    if (state !== 'playing' || !activeBlock) return;

    const prevBlock = blocks[blocks.length - 1];
    const diff = activeBlock.x - prevBlock.x;
    const perfectThreshold = Math.max(3.5, stageWidth * 0.022);

    // 1. 퍼펙트 판정
    if (Math.abs(diff) <= perfectThreshold) {
      activeBlock.x = prevBlock.x;
      combo++;
      navigator.vibrate?.(25);

      // 점진적 콤보 회복 (초기 3스택 시작, 회복 시마다 필요 콤보 요구량 1씩 증가: 3 -> 4 -> 5...)
      // 회복량도 기존의 절반(4.5%)으로 줄여 긴장감 강화
      if (combo >= comboThreshold) {
        const bonusAmount = Math.round(baseWidth * 0.045); // 넓이 반으로 축소
        const actualBonus = Math.min(bonusAmount, baseWidth - activeBlock.width);

        if (actualBonus > 0) {
          const screenCenter = stageWidth / 2;
          const blockCenter = activeBlock.x + activeBlock.width / 2;
          const centerDiff = blockCenter - screenCenter;

          if (centerDiff < -2) {
            // 중앙보다 왼쪽: 오른쪽(중앙 방향)으로 확장
            activeBlock.width += actualBonus;
          } else if (centerDiff > 2) {
            // 중앙보다 오른쪽: 왼쪽(중앙 방향)으로 확장
            activeBlock.x -= actualBonus;
            activeBlock.width += actualBonus;
          } else {
            // 이미 정중앙: 양옆으로 균등 확장
            activeBlock.x -= actualBonus / 2;
            activeBlock.width += actualBonus;
          }

          // 화면 경계 안전 보정
          if (activeBlock.x < 0) activeBlock.x = 0;
          if (activeBlock.x + activeBlock.width > stageWidth) {
            activeBlock.width = stageWidth - activeBlock.x;
          }

          currentWidth = activeBlock.width;
        }

        // 회복 성공 시 다음 필요 콤보 요구량 1씩 증가!
        recoveryCount++;
        comboThreshold = combo + (3 + recoveryCount);
      }

      flashEffects.push({
        x: activeBlock.x,
        y: activeBlock.y,
        width: activeBlock.width,
        height: activeBlock.height,
        alpha: 1.0
      });

      const comboMsg = combo > 1 ? ` COMBO x${combo}!` : '';
      $('#message').textContent = `${blocks.length}층! PERFECT!${comboMsg}`;
      blocks.push(activeBlock);
      score = blocks.length;
      spawnNextBlock();
      return;
    }

    // 2. 오차 발생 시 잘라내기 판정
    combo = 0;
    comboThreshold = 3 + recoveryCount; // 콤보 끊긴 후 다음 회복에 필요한 연속 콤보 요구량
    let placedX = activeBlock.x;
    let placedWidth = activeBlock.width;
    let debrisX = 0;
    let debrisWidth = 0;

    if (diff > 0) {
      // 오른쪽으로 삐져나옴
      const overlap = prevBlock.width - diff;
      if (overlap <= 0) {
        gameOver(true, 1);
        return;
      }
      placedX = activeBlock.x;
      placedWidth = overlap;
      debrisX = prevBlock.x + prevBlock.width;
      debrisWidth = diff;
    } else {
      // 왼쪽으로 삐져나옴
      const overlap = activeBlock.width + diff;
      if (overlap <= 0) {
        gameOver(true, -1);
        return;
      }
      placedX = prevBlock.x;
      placedWidth = overlap;
      debrisX = activeBlock.x;
      debrisWidth = -diff;
    }

    currentWidth = placedWidth;
    activeBlock.x = placedX;
    activeBlock.width = placedWidth;
    blocks.push(activeBlock);
    score = blocks.length;
    $('#message').textContent = tr(`층수: ${score}`, `Floor: ${score}`);

    // 잘린 파편 생성
    debrisList.push({
      x: debrisX,
      y: activeBlock.y,
      width: debrisWidth,
      height: blockHeight,
      color: activeBlock.color,
      vy: -15,
      vx: (diff > 0 ? 35 : -35),
      rotation: 0,
      vRot: (diff > 0 ? 0.08 : -0.08),
      alpha: 1.0
    });

    navigator.vibrate?.(15);
    spawnNextBlock();
  }

  function gameOver(hasFallenBlock = false, fallDirection = 1) {
    isRunning = false;
    navigator.vibrate?.([60, 40, 100]);

    if (hasFallenBlock && activeBlock) {
      debrisList.push({
        x: activeBlock.x,
        y: activeBlock.y,
        width: activeBlock.width,
        height: activeBlock.height,
        color: activeBlock.color,
        vy: 20,
        vx: fallDirection * 60,
        rotation: 0,
        vRot: fallDirection * 0.15,
        alpha: 1.0
      });
      activeBlock = null;
    }

    const finalScore = score;
    const isNew = saveBest('stack', finalScore);
    showBest('stack');

    const msg = isNew
      ? tr(`최고 기록! ${finalScore}층`, `New Record! Floor ${finalScore}`)
      : tr(`${finalScore}층 도달!`, `Reached Floor ${finalScore}`);

    setState('idle', tr('다시 시작', 'Try again'), msg);

    // 잔여 파편 애니메이션 마저 처리
    let overFrames = 40;
    function overLoop() {
      if (isRunning) return;
      updateDebris(0.016);
      drawScene();
      if (debrisList.length > 0 && --overFrames > 0) {
        requestAnimationFrame(overLoop);
      }
    }
    requestAnimationFrame(overLoop);
  }

  function updateDebris(dt) {
    const gravity = 800;
    for (let i = debrisList.length - 1; i >= 0; i--) {
      const d = debrisList[i];
      d.vy += gravity * dt;
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      d.rotation += d.vRot;
      d.alpha -= dt * 1.5;
      if (d.alpha <= 0 || d.y - cameraY > stageHeight + 100) {
        debrisList.splice(i, 1);
      }
    }
  }

  let lastTime = 0;
  function loop(currentTime) {
    if (!isRunning) return;

    if (!lastTime) lastTime = currentTime;
    const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
    lastTime = currentTime;

    // 1. 활성 블록 좌우 왕복 (대칭 턴으로 리듬 유지)
    if (activeBlock) {
      activeBlock.x += activeBlock.speed * dt;
      const rightBound = activeBlock.maxX ?? (stageWidth - activeBlock.width * 0.8);
      const leftBound = activeBlock.minX ?? (-activeBlock.width * 0.2);

      if (activeBlock.x >= rightBound && activeBlock.direction > 0) {
        activeBlock.x = rightBound;
        activeBlock.speed = -Math.abs(activeBlock.speed);
        activeBlock.direction = -1;
      } else if (activeBlock.x <= leftBound && activeBlock.direction < 0) {
        activeBlock.x = leftBound;
        activeBlock.speed = Math.abs(activeBlock.speed);
        activeBlock.direction = 1;
      }
    }

    // 2. 카메라 부드러운 스크롤 (Lerp)
    cameraY += (targetCameraY - cameraY) * 0.12;

    // 3. 파편 물리
    updateDebris(dt);

    // 4. 퍼펙트 플래시 감쇠
    for (let i = flashEffects.length - 1; i >= 0; i--) {
      flashEffects[i].alpha -= dt * 3.5;
      if (flashEffects[i].alpha <= 0) flashEffects.splice(i, 1);
    }

    drawScene();
    animFrame = requestAnimationFrame(loop);
  }

  function drawScene() {
    if (!ctx) return;
    ctx.clearRect(0, 0, stageWidth, stageHeight);

    ctx.save();
    ctx.translate(0, -cameraY);

    const isLight = document.documentElement.dataset.theme === 'light';
    const isContrast = document.documentElement.dataset.theme === 'contrast';

    // 1. 쌓여있는 블록 렌더링
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      // 화면 밖이면 컬링
      if (b.y - cameraY > stageHeight + 50 || b.y + b.height - cameraY < -50) continue;

      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.width, b.height);

      // 상단 하이라이트 라인으로 입체감/세련됨 부여
      ctx.fillStyle = isContrast ? '#fff' : (isLight ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.25)');
      ctx.fillRect(b.x, b.y, b.width, 2);

      // 측면 엣지 라인
      ctx.fillStyle = isContrast ? '#000' : 'rgba(0,0,0,0.15)';
      ctx.fillRect(b.x, b.y + b.height - 2, b.width, 2);
    }

    // 2. 현재 움직이는 블록 렌더링
    if (activeBlock) {
      ctx.fillStyle = activeBlock.color;
      ctx.fillRect(activeBlock.x, activeBlock.y, activeBlock.width, activeBlock.height);

      ctx.fillStyle = isContrast ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.fillRect(activeBlock.x, activeBlock.y, activeBlock.width, 2);
    }

    // 3. 떨어지는 파편(Debris) 렌더링
    for (let i = 0; i < debrisList.length; i++) {
      const d = debrisList[i];
      ctx.save();
      ctx.globalAlpha = Math.max(0, d.alpha);
      ctx.translate(d.x + d.width / 2, d.y + d.height / 2);
      ctx.rotate(d.rotation);
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.width / 2, -d.height / 2, d.width, d.height);
      ctx.restore();
    }

    // 4. 퍼펙트 플래시 이펙트 렌더링
    for (let i = 0; i < flashEffects.length; i++) {
      const f = flashEffects[i];
      ctx.save();
      ctx.globalAlpha = f.alpha;
      ctx.strokeStyle = isContrast ? '#00ff66' : '#ffffff';
      ctx.lineWidth = 3;
      ctx.strokeRect(f.x - 2, f.y - 2, f.width + 4, f.height + 4);
      ctx.restore();
    }

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
      gameOver();
    }
  }

  registerGame('stack', {
    init,
    onAction,
    onCancel,
    onResize,
    onVisibilityChange
  });
})();
