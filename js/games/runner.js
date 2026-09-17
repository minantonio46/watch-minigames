'use strict';

(function () {
  let runnerFrame = null;
  let runnerRunToken = 0;
  let runnerRunning = false;
  let runnerHolding = false;
  let runnerPointerDown = false;
  let runnerRestartArmed = true;
  let runnerIgnoreNextClick = false;
  let runnerY = 0;
  let runnerVelocity = 0;
  let runnerHoldMs = 0;
  let runnerSpeed = 0;
  let runnerScore = 0;
  let runnerLastFrame = 0;
  const runnerObstacleGlyphs = ['square', 'grid', 'cross', 'command', 'bars'];
  const RUNNER_MAX_DIFFICULTY_SCORE = 500;
  const RUNNER_REFERENCE_STAGE_HEIGHT = 155;
  const RUNNER_MAX_EMPTY_SECONDS = 0.72;
  const RUNNER_COLLISION_GRACE_SCORE = 3;
  let runnerObstacles = [];
  let runnerAirObstacleCount = 0;
  let runnerGroundObstacleCount = 0;
  let runnerStageWidth = 0;
  let runnerStageHeight = 0;

  let runnerPlayerGeometry = {
    hitLeft: 0,
    hitBottom: 0,
    hitWidth: 0,
    hitHeight: 0
  };
  const RUNNER_PLAYER_HIT_INSET_RATIO = 0.065;

  function stopRunner(hideObstacles = true) {
    runnerRunToken++;
    if (runnerFrame !== null) cancelAnimationFrame(runnerFrame);
    runnerFrame = null;
    runnerRunning = false;
    runnerHolding = false;
    if (hideObstacles) {
      $('#runner-stage')?.removeAttribute('data-running');
      clearRunnerHitboxDebug();
    }
  }

  function scheduleRunnerFrame() {
    const token = runnerRunToken;
    runnerFrame = requestAnimationFrame(frameTime => {
      if (token !== runnerRunToken) return;
      runnerFrame = null;
      runRunner(frameTime);
    });
  }

  function resetRunnerPreview() {
    runnerScore = 0;
    runnerPointerDown = false;
    runnerRestartArmed = true;
    runnerIgnoreNextClick = false;
    $('#runner-score').textContent = '';
    $('#runner-player').style.transform = 'translateY(0)';
    $('#runner-hitbox-player').style.transform = 'translateY(0)';
    $('#runner-obstacle').style.left = '0px';
    $('#runner-obstacle-next').style.left = '0px';
    $('#runner-obstacle-tail').style.left = '0px';
    runnerObstacles = [];
    runnerStageWidth = 0;
    runnerStageHeight = 0;
    clearRunnerHitboxDebug();
  }

  function runnerJump() {
    const stage = $('#runner-stage');
    const stageHeight = stage?.clientHeight || RUNNER_REFERENCE_STAGE_HEIGHT;
    const physicsScale = stageHeight / RUNNER_REFERENCE_STAGE_HEIGHT;
    if (!runnerRunning || runnerY > stageHeight * 0.006) return;
    runnerVelocity = 285 * physicsScale;
    runnerHoldMs = 0;
  }

  function runnerOverscan(stageHeight) {
    return stageHeight * 1.35;
  }

  function runnerSafeGap(previous, obstacle, stageWidth, speed) {
    const idealGap = speed * Math.max(previous.recoverySeconds, obstacle.entrySeconds);
    const maxGap = stageWidth + speed * RUNNER_MAX_EMPTY_SECONDS;
    return Math.min(idealGap, maxGap);
  }

  function syncRunnerPlayerGeometry(width, height) {
    const playerNode = $('#runner-player');
    const playerWidth = playerNode?.offsetWidth || (width * 0.075);
    const playerHeight = playerNode?.offsetHeight || (height * 0.17);
    const playerLeft = width * 0.12;
    const inset = playerWidth * RUNNER_PLAYER_HIT_INSET_RATIO;
    const groundHeight = height * (0.004 / 0.38); // aligns with calc(var(--square) * .004) ground line
    runnerPlayerGeometry = {
      hitLeft: playerLeft + inset,
      hitBottom: groundHeight + inset,
      hitWidth: Math.max(1, playerWidth - inset * 2),
      hitHeight: Math.max(1, playerHeight - inset * 2)
    };
    const hitboxPlayer = $('#runner-hitbox-player');
    if (hitboxPlayer) {
      hitboxPlayer.style.left = `${runnerPlayerGeometry.hitLeft}px`;
      hitboxPlayer.style.bottom = `${runnerPlayerGeometry.hitBottom}px`;
      hitboxPlayer.style.width = `${runnerPlayerGeometry.hitWidth}px`;
      hitboxPlayer.style.height = `${runnerPlayerGeometry.hitHeight}px`;
      hitboxPlayer.style.transform = `translateY(${-runnerY}px)`;
    }
  }

  function syncRunnerStageSize(width, height) {
    if (!width || !height) return;
    syncRunnerPlayerGeometry(width, height);
    if (!runnerStageWidth || !runnerStageHeight) {
      runnerStageWidth = width;
      runnerStageHeight = height;
      return;
    }
    if (Math.abs(width - runnerStageWidth) < 0.5 && Math.abs(height - runnerStageHeight) < 0.5) return;

    const horizontalScale = width / runnerStageWidth;
    const verticalScale = height / runnerStageHeight;
    runnerY *= verticalScale;
    runnerVelocity *= verticalScale;
    runnerObstacles.forEach(obstacle => {
      obstacle.x *= horizontalScale;
      obstacle.bottom *= verticalScale;
      obstacle.fontSize *= verticalScale;
      obstacle.node.style.left = `${obstacle.x}px`;
      obstacle.node.style.bottom = `${obstacle.bottom}px`;
      obstacle.node.style.fontSize = `${obstacle.fontSize}px`;
      measureRunnerObstacle(obstacle);
      obstacle.previousX = undefined;
      obstacle.previousGeneration = null;
    });
    runnerStageWidth = width;
    runnerStageHeight = height;
  }

  function renderRunner() {
    const transform = `translateY(${-runnerY}px)`;
    $('#runner-player').style.transform = transform;
    const hitboxPlayer = $('#runner-hitbox-player');
    if (hitboxPlayer) hitboxPlayer.style.transform = transform;
    runnerObstacles.forEach(obstacle => {
      obstacle.node.style.left = `${obstacle.x}px`;
    });
    $('#runner-score').textContent = tr(`${Math.floor(runnerScore)}점`, `${Math.floor(runnerScore)} pts`);
  }

  function setRunnerObstacleGlyph(obstacle, glyphType, repeatCount = 1) {
    obstacle.glyphType = glyphType;
    obstacle.visualRepeats = repeatCount;
    obstacle.node.dataset.glyph = glyphType;
  }

  function measureRunnerObstacle(obstacle) {
    const fontSize = Math.max(1, obstacle.fontSize || 16);
    const repeatCount = Math.max(1, obstacle.visualRepeats || 1);
    const unitSize = fontSize * 0.78;
    const gap = unitSize * 0.08;
    const node = obstacle.node;
    while (node.childElementCount < repeatCount) {
      const unit = document.createElement('span');
      unit.className = 'runner-obstacle-unit';
      node.append(unit);
    }
    while (node.childElementCount > repeatCount) {
      node.lastElementChild.remove();
    }
    obstacle.width = unitSize * repeatCount + gap * (repeatCount - 1);
    obstacle.height = unitSize;
    node.style.setProperty('--runner-obstacle-unit', `${unitSize}px`);
    node.style.gap = `${gap}px`;
    node.style.width = `${obstacle.width}px`;
    node.style.height = `${obstacle.height}px`;
  }

  function runnerPlayerHitBox() {
    const bottom = runnerY + runnerPlayerGeometry.hitBottom;
    return {
      left: runnerPlayerGeometry.hitLeft,
      right: runnerPlayerGeometry.hitLeft + runnerPlayerGeometry.hitWidth,
      bottom,
      top: bottom + runnerPlayerGeometry.hitHeight
    };
  }

  function runnerObstacleHitBox(obstacle) {
    return {
      left: obstacle.x,
      right: obstacle.x + obstacle.width,
      bottom: obstacle.bottom,
      top: obstacle.bottom + obstacle.height
    };
  }

  function positionRunnerHitboxDebug(node, box) {
    node.style.left = `${box.left}px`;
    node.style.bottom = `${box.bottom}px`;
    node.style.width = `${Math.max(1, box.right - box.left)}px`;
    node.style.height = `${Math.max(1, box.top - box.bottom)}px`;
  }

  function clearRunnerHitboxDebug() {
    $('#runner-stage')?.removeAttribute('data-hitbox-ready');
  }

  function renderRunnerHitboxDebug(obstacleBoxes) {
    const debugNodes = [
      $('#runner-hitbox-obstacle'),
      $('#runner-hitbox-obstacle-next'),
      $('#runner-hitbox-obstacle-tail')
    ];
    obstacleBoxes.forEach((box, index) => positionRunnerHitboxDebug(debugNodes[index], box));
    $('#runner-stage').dataset.hitboxReady = 'true';
  }

  function runnerHitBoxesIntersect(playerBox, obstacleBox) {
    return obstacleBox.left < playerBox.right
      && obstacleBox.right > playerBox.left
      && playerBox.top > obstacleBox.bottom
      && playerBox.bottom < obstacleBox.top;
  }

  function buildRunnerObstacle(obstacle, stageWidth, stageHeight, x) {
    obstacle.x = x;
    obstacle.node.style.left = `${x}px`;
    obstacle.node.style.transform = 'none';
    setRunnerObstacleGlyph(obstacle, obstacle.glyphType || 'square', 1);
    obstacle.generation = (obstacle.generation || 0) + 1;
    obstacle.previousX = undefined;
    obstacle.previousGeneration = null;

    const difficulty = Math.min(1, runnerScore / RUNNER_MAX_DIFFICULTY_SCORE);
    const roll = Math.random();
    let kind = 'low';
    const canSpawnAir = runnerAirObstacleCount < runnerGroundObstacleCount * 2;
    if (difficulty > 0.14 && canSpawnAir && roll < 0.15 + difficulty * 0.08) kind = 'air';
    else if (difficulty > 0.18 && roll < 0.24 + difficulty * 0.12) kind = 'tall';
    else if (difficulty > 0.28 && roll < 0.44 + difficulty * 0.18) kind = 'wide';
    else if (roll > 0.66 - difficulty * 0.15) kind = 'quick';

    const specs = {
      low: { height: 0.16 + difficulty * 0.05, width: 0.09 + difficulty * 0.03, entry: 0.72, recovery: 0.96 },
      quick: { height: 0.13 + difficulty * 0.04, width: 0.08, entry: 0.78, recovery: 0.88 },
      air: { height: 0.13 + difficulty * 0.02, width: 0.12, bottom: 0.23 + difficulty * 0.02, entry: 0.90, recovery: 0.94 },
      tall: { height: 0.34 + difficulty * 0.12, width: 0.10, entry: 1.04, recovery: 1.26 },
      wide: { height: 0.18 + difficulty * 0.05, width: 0.30 + difficulty * 0.12, entry: 1.10, recovery: 1.34 }
    }[kind];
    const airRepeats = kind === 'air'
      ? (difficulty > 0.35 && Math.random() < 0.28 ? 4 : (Math.random() < 0.55 ? 2 : 1))
      : null;
    if (kind === 'air') {
      specs.entry = airRepeats === 4 ? 1.12 : specs.entry;
      specs.recovery = airRepeats === 4 ? 1.20 : specs.recovery;
    }
    obstacle.kind = kind;
    const groundHeight = stageHeight * (0.004 / 0.30);
    obstacle.height = stageHeight * specs.height;
    obstacle.width = stageWidth * specs.width;
    obstacle.bottom = groundHeight + stageHeight * (specs.bottom ?? 0);
    obstacle.entrySeconds = specs.entry;
    obstacle.recoverySeconds = specs.recovery;
    obstacle.repeatCount = airRepeats;
    if (kind === 'air') runnerAirObstacleCount++;
    else runnerGroundObstacleCount++;
    const fontSize = obstacle.height * 1.25;
    let groundRepeats = 1;
    if (kind === 'wide') {
      groundRepeats = 4;
    } else if (kind === 'tall') {
      groundRepeats = Math.random() < 0.7 ? 1 : 2;
    } else {
      groundRepeats = Math.random() < (kind === 'quick' ? 0.75 : 0.50) ? 1 : 2;
    }
    obstacle.height = fontSize;
    obstacle.fontSize = fontSize;
    if (kind !== 'air') obstacle.width = fontSize * 0.68 * groundRepeats;
    obstacle.node.style.width = `${obstacle.width}px`;
    obstacle.node.style.height = '';
    obstacle.node.style.fontSize = `${fontSize}px`;
    const glyph = runnerObstacleGlyphs[Math.floor(Math.random() * runnerObstacleGlyphs.length)];
    setRunnerObstacleGlyph(obstacle, glyph, 1);
    obstacle.node.style.bottom = `${obstacle.bottom}px`;
    if (kind === 'air') {
      obstacle.width = fontSize * 0.92 * airRepeats;
      obstacle.node.style.width = `${obstacle.width}px`;
      obstacle.node.style.letterSpacing = '';
      setRunnerObstacleGlyph(obstacle, glyph, airRepeats);
    } else {
      obstacle.node.classList.remove('air-bundle');
      obstacle.node.style.letterSpacing = '';
      setRunnerObstacleGlyph(obstacle, glyph, groundRepeats);
    }
    measureRunnerObstacle(obstacle);
  }

  function endRunner() {
    stopRunner(false);
    runnerRestartArmed = !runnerPointerDown;
    const score = Math.floor(runnerScore);
    saveBest('runner', score);
    showBest('runner');
    setState('idle', tr('다시 달리기', 'Run again'), tr(`${score}점! 탭해서 다시 시작`, `${score} pts! Tap to run again`));
  }

  function runRunner(frameTime) {
    if (!runnerRunning || current !== 'runner') return;
    const elapsed = Math.max(0, Math.min(40, frameTime - runnerLastFrame)) / 1000;
    runnerLastFrame = frameTime;
    const stage = $('#runner-stage');
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) { scheduleRunnerFrame(); return; }
    syncRunnerStageSize(width, height);

    const physicsScale = height / RUNNER_REFERENCE_STAGE_HEIGHT;
    if (runnerHolding && runnerVelocity > 0 && runnerHoldMs < 220) {
      runnerVelocity += 680 * physicsScale * elapsed;
      runnerHoldMs += elapsed * 1000;
    }
    runnerVelocity -= 850 * physicsScale * elapsed;
    runnerY += runnerVelocity * elapsed;
    if (runnerY <= 0) {
      runnerY = 0;
      runnerVelocity = 0;
      if (runnerHolding) runnerJump();
    }
    const difficulty = Math.min(1, runnerScore / RUNNER_MAX_DIFFICULTY_SCORE);
    const endlessSpeedBonus = Math.log1p(Math.max(0, runnerScore - RUNNER_MAX_DIFFICULTY_SCORE) / 500) * 0.05;
    runnerSpeed = width * (0.44 + difficulty * 0.76 + endlessSpeedBonus);
    runnerScore += elapsed * 10;

    runnerObstacles.forEach(obstacle => { obstacle.recycledThisFrame = false; });
    runnerObstacles.forEach(obstacle => { obstacle.x -= runnerSpeed * elapsed; });
    runnerObstacles.forEach(obstacle => {
      const overscan = runnerOverscan(height);
      if (obstacle.x + obstacle.width >= -overscan) return;
      const previous = runnerObstacles.filter(item => item !== obstacle).reduce((furthest, item) => (
        item.x + item.width > furthest.x + furthest.width ? item : furthest
      ));
      const stagingX = width + overscan;
      buildRunnerObstacle(obstacle, width, height, stagingX);
      obstacle.recycledThisFrame = true;
      const safeGap = runnerSafeGap(previous, obstacle, width, runnerSpeed);
      obstacle.x = Math.max(stagingX, previous.x + previous.width + safeGap);
      obstacle.node.style.left = `${obstacle.x}px`;
    });

    renderRunner();
    const playerBox = runnerPlayerHitBox();
    const currentObstacleBoxes = runnerObstacles.map(obstacle => runnerObstacleHitBox(obstacle));
    renderRunnerHitboxDebug(currentObstacleBoxes);
    const hit = runnerScore >= RUNNER_COLLISION_GRACE_SCORE && runnerObstacles.some((obstacle, index) => {
      if (obstacle.recycledThisFrame) return false;
      const obstacleBox = currentObstacleBoxes[index];
      if (runnerHitBoxesIntersect(playerBox, obstacleBox)) return true;
      const verticalOverlap = playerBox.top > obstacleBox.bottom && playerBox.bottom < obstacleBox.top;
      if (!verticalOverlap) return false;
      if (obstacle.previousX === undefined || obstacle.previousGeneration !== obstacle.generation) return false;
      const minX = Math.min(obstacle.previousX, obstacleBox.left);
      const maxX = Math.max(obstacle.previousX + obstacle.width, obstacleBox.right);
      return maxX > playerBox.left && minX < playerBox.right;
    });
    if (hit) {
      endRunner();
      return;
    }
    runnerObstacles.forEach((obstacle) => {
      if (obstacle.recycledThisFrame) {
        obstacle.previousX = undefined;
        obstacle.previousGeneration = null;
        return;
      }
      obstacle.previousX = obstacle.x;
      obstacle.previousGeneration = obstacle.generation;
    });
    scheduleRunnerFrame();
  }

  function startRunner() {
    const stage = $('#runner-stage');
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;

    stopRunner(false);
    clearRunnerHitboxDebug();
    stage.dataset.running = 'true';
    runnerRunning = true;
    runnerRestartArmed = false;
    runnerHolding = false;
    runnerY = 0;
    runnerVelocity = 0;
    runnerHoldMs = 0;
    runnerSpeed = width * 0.44;
    runnerScore = 0;
    runnerAirObstacleCount = 0;
    runnerGroundObstacleCount = 0;
    runnerLastFrame = performance.now();
    runnerStageWidth = width;
    runnerStageHeight = height;
    runnerObstacles = [
      { node: $('#runner-obstacle') },
      { node: $('#runner-obstacle-next') },
      { node: $('#runner-obstacle-tail') }
    ];

    const entryX = width + runnerSpeed * 0.7;
    const stagingX = width + runnerOverscan(height);
    buildRunnerObstacle(runnerObstacles[0], width, height, entryX);
    buildRunnerObstacle(runnerObstacles[1], width, height, stagingX);
    runnerObstacles[1].x = runnerObstacles[0].x + runnerObstacles[0].width + runnerSafeGap(runnerObstacles[0], runnerObstacles[1], width, runnerSpeed);
    runnerObstacles[1].node.style.left = `${runnerObstacles[1].x}px`;
    buildRunnerObstacle(runnerObstacles[2], width, height, stagingX);
    runnerObstacles[2].x = runnerObstacles[1].x + runnerObstacles[1].width + runnerSafeGap(runnerObstacles[1], runnerObstacles[2], width, runnerSpeed);
    runnerObstacles[2].node.style.left = `${runnerObstacles[2].x}px`;

    $('#message').textContent = tr('짧게: 낮은 점프 · 꾹: 최고 점프 연속', 'Tap: low jump · Hold: repeat high jumps');
    state = 'playing';
    document.body.dataset.state = 'idle';
    syncRunnerPlayerGeometry(width, height);
    renderRunner();
    renderRunnerHitboxDebug(runnerObstacles.map(obstacle => runnerObstacleHitBox(obstacle)));
    scheduleRunnerFrame();
  }

  function init() {
    resetRunnerPreview();
    setState('idle', tr('눌러서 시작', 'Tap to start'), tr('짧게 점프 · 꾹 누르면 연속 점프', 'Tap to jump · hold to repeat jump'));
  }

  function onAction() {
    if (runnerIgnoreNextClick) {
      runnerIgnoreNextClick = false;
      return;
    }
    if (!runnerRunning && runnerRestartArmed) {
      startRunner();
    }
  }

  function onPointerDown(event) {
    event.preventDefault();
    runnerPointerDown = true;
    if (!runnerRunning) {
      if (runnerRestartArmed) startRunner();
    } else {
      runnerHolding = true;
      runnerJump();
    }
  }

  function onPointerUp() {
    runnerPointerDown = false;
    runnerHolding = false;
    if (!runnerRunning) {
      runnerRestartArmed = true;
      runnerIgnoreNextClick = true;
    }
  }

  function onKeyDown(event) {
    if (!runnerRunning || ![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    if (event.repeat) return;
    runnerHolding = true;
    runnerJump();
  }

  function onKeyUp(event) {
    if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    runnerHolding = false;
  }

  function onResize() {
    if (!runnerObstacles.length) return;
    const stage = $('#runner-stage');
    syncRunnerStageSize(stage.clientWidth, stage.clientHeight);
    renderRunner();
    renderRunnerHitboxDebug(runnerObstacles.map(obstacle => runnerObstacleHitBox(obstacle)));
  }

  function onCancel() {
    stopRunner();
    resetRunnerPreview();
  }

  function onVisibilityChange(isHidden) {
    if (isHidden && runnerRunning) {
      stopRunner();
      runnerPointerDown = false;
      runnerRestartArmed = true;
      runnerIgnoreNextClick = false;
      setState('idle', tr('다시 시작', 'Try again'), tr('잠시 멈췄어요', 'Round paused'));
    }
  }

  registerGame('runner', {
    init,
    onAction,
    onPointerDown,
    onPointerUp,
    onKeyDown,
    onKeyUp,
    onResize,
    onCancel,
    onVisibilityChange
  });
})();
