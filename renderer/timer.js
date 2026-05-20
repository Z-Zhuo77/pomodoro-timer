const WORK_DURATION = 25 * 60;
const SHORT_DURATION = 5 * 60;
const BREAK_DURATION = 5 * 60;
const STOPWATCH_MAX = 60 * 60; // 60 分钟后归零
const CIRCUMFERENCE = 2 * Math.PI * 135;

const state = {
  timerMode: 'long',           // 'long' | 'short' | 'stopwatch'
  phase: 'idle',               // 'idle' | 'working' | 'breaking' | 'paused'
  workDuration: WORK_DURATION,
  timeRemaining: WORK_DURATION,
  stopwatchTime: 0,
  sessionCount: 0,
  intervalId: null,
};

// DOM
const timerDisplay = document.getElementById('timer-display');
const sessionLabel = document.getElementById('session-label');
const sessionCount = document.getElementById('session-count');
const circleFg = document.querySelector('.timer-circle-fg');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');
const modeBtns = document.querySelectorAll('.mode-btn');

function isCountdown() {
  return state.timerMode === 'long' || state.timerMode === 'short';
}

function isStopwatch() {
  return state.timerMode === 'stopwatch';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateUI() {
  if (isStopwatch()) {
    timerDisplay.textContent = formatTime(state.stopwatchTime);
    const progress = (state.stopwatchTime % STOPWATCH_MAX) / STOPWATCH_MAX;
    circleFg.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
    circleFg.classList.remove('break');
    sessionLabel.textContent = '计时中';
    sessionLabel.classList.remove('break');
  } else {
    timerDisplay.textContent = formatTime(state.timeRemaining);
    const total = state.phase === 'breaking' ? BREAK_DURATION : state.workDuration;
    const progress = state.timeRemaining / total;
    circleFg.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);

    if (state.phase === 'breaking') {
      circleFg.classList.add('break');
      sessionLabel.textContent = '休息';
      sessionLabel.classList.add('break');
    } else {
      circleFg.classList.remove('break');
      sessionLabel.textContent = '工作';
      sessionLabel.classList.remove('break');
    }
  }

  sessionCount.textContent = state.sessionCount > 0 ? `#${state.sessionCount}` : '';

  const isIdle = state.phase === 'idle';
  const isPaused = state.phase === 'paused';
  const isRunning = state.phase === 'working' || state.phase === 'breaking';

  btnStart.disabled = !(isIdle || isPaused);
  btnStart.textContent = isPaused ? '继续' : '开始';
  btnPause.disabled = !isRunning;
  btnReset.disabled = isIdle;
}

function tick() {
  if (isStopwatch()) {
    state.stopwatchTime += 1;
    if (state.stopwatchTime >= STOPWATCH_MAX) {
      state.stopwatchTime = 0;
    }
  } else {
    state.timeRemaining -= 1;
    if (state.timeRemaining <= 0) {
      onTimerComplete();
      return;
    }
  }
  updateUI();
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (_) {}
}

async function onTimerComplete() {
  clearInterval(state.intervalId);
  state.intervalId = null;
  playBeep();

  if (state.phase === 'working') {
    state.sessionCount += 1;
    state.phase = 'breaking';
    state.timeRemaining = BREAK_DURATION;
    updateUI();

    try {
      await window.electronAPI.showNotification(
        '工作时间结束！',
        `已完成第 ${state.sessionCount} 个番茄。休息 5 分钟吧。`
      );
    } catch (_) {}

    state.intervalId = setInterval(tick, 1000);
  } else if (state.phase === 'breaking') {
    state.phase = 'idle';
    state.timeRemaining = state.workDuration;
    updateUI();

    try {
      await window.electronAPI.showNotification(
        '休息结束！',
        '该开始下一轮工作了。'
      );
    } catch (_) {}
  }
}

function switchMode(mode) {
  if (state.intervalId !== null) return;

  state.timerMode = mode;
  modeBtns.forEach(b => b.classList.remove('active'));
  document.querySelector(`.mode-btn[data-mode="${mode}"]`).classList.add('active');

  if (mode === 'long') {
    state.workDuration = WORK_DURATION;
  } else if (mode === 'short') {
    state.workDuration = SHORT_DURATION;
  }

  state.phase = 'idle';
  state.timeRemaining = state.workDuration;
  state.stopwatchTime = 0;
  state.sessionCount = 0;
  updateUI();
}

function startTimer() {
  if (state.intervalId !== null) return;

  if (state.phase === 'idle') {
    if (isStopwatch()) {
      state.phase = 'working';
    } else {
      state.phase = 'working';
      state.timeRemaining = state.workDuration;
    }
  } else if (state.phase === 'paused') {
    if (isStopwatch()) {
      state.phase = 'working';
    } else {
      state.phase = state.timeRemaining <= BREAK_DURATION &&
                    state.sessionCount > 0 &&
                    state.phase === 'paused' ? 'breaking' : 'working';
    }
  }

  updateUI();
  state.intervalId = setInterval(tick, 1000);
}

function pauseTimer() {
  if (state.intervalId === null) return;

  clearInterval(state.intervalId);
  state.intervalId = null;
  state.phase = 'paused';
  updateUI();
}

function resetTimer() {
  if (state.intervalId !== null) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  state.phase = 'idle';
  state.timeRemaining = state.workDuration;
  state.stopwatchTime = 0;
  state.sessionCount = 0;
  updateUI();
}

btnStart.addEventListener('click', startTimer);
btnPause.addEventListener('click', pauseTimer);
btnReset.addEventListener('click', resetTimer);
modeBtns.forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));

updateUI();
