const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;
const CIRCUMFERENCE = 2 * Math.PI * 135; // ~848.23

const state = {
  mode: 'idle',        // 'idle' | 'working' | 'breaking' | 'paused'
  timeRemaining: WORK_DURATION,
  totalTime: WORK_DURATION,
  sessionCount: 0,
  intervalId: null,
};

// DOM elements
const timerDisplay = document.getElementById('timer-display');
const sessionLabel = document.getElementById('session-label');
const sessionCount = document.getElementById('session-count');
const circleFg = document.querySelector('.timer-circle-fg');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateUI() {
  timerDisplay.textContent = formatTime(state.timeRemaining);

  const progress = state.timeRemaining / state.totalTime;
  circleFg.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const isWorking = state.mode === 'working' || (state.mode === 'paused' && state.totalTime === WORK_DURATION);
  const isBreaking = state.mode === 'breaking' || (state.mode === 'paused' && state.totalTime === BREAK_DURATION);
  const isIdle = state.mode === 'idle';
  const isPaused = state.mode === 'paused';

  if (isBreaking) {
    circleFg.classList.add('break');
    sessionLabel.textContent = '休息';
    sessionLabel.classList.add('break');
  } else {
    circleFg.classList.remove('break');
    sessionLabel.textContent = '工作';
    sessionLabel.classList.remove('break');
  }

  sessionCount.textContent = state.sessionCount > 0 ? `#${state.sessionCount}` : '';

  // Button states
  btnStart.disabled = !(isIdle || isPaused);
  btnStart.textContent = isPaused ? '继续' : '开始';
  btnPause.disabled = !(state.mode === 'working' || state.mode === 'breaking');
  btnReset.disabled = isIdle;
}

function tick() {
  state.timeRemaining -= 1;

  if (state.timeRemaining <= 0) {
    onTimerComplete();
    return;
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
  } catch (_) {
    // Ignore audio errors
  }
}

async function onTimerComplete() {
  clearInterval(state.intervalId);
  state.intervalId = null;

  playBeep();

  if (state.mode === 'working') {
    state.sessionCount += 1;
    state.mode = 'breaking';
    state.timeRemaining = BREAK_DURATION;
    state.totalTime = BREAK_DURATION;
    updateUI();

    try {
      await window.electronAPI.showNotification(
        '工作时间结束！',
        `已完成第 ${state.sessionCount} 个番茄。休息 5 分钟吧。`
      );
    } catch (_) {}

    // Auto-start break
    state.intervalId = setInterval(tick, 1000);
  } else if (state.mode === 'breaking') {
    state.mode = 'idle';
    state.timeRemaining = WORK_DURATION;
    state.totalTime = WORK_DURATION;
    updateUI();

    try {
      await window.electronAPI.showNotification(
        '休息结束！',
        '该开始下一轮工作了。'
      );
    } catch (_) {}
  }
}

function startTimer() {
  if (state.intervalId !== null) return;

  if (state.mode === 'idle') {
    state.mode = 'working';
    state.timeRemaining = WORK_DURATION;
    state.totalTime = WORK_DURATION;
  } else if (state.mode === 'paused') {
    state.mode = state.totalTime === BREAK_DURATION ? 'breaking' : 'working';
  }

  updateUI();
  state.intervalId = setInterval(tick, 1000);
}

function pauseTimer() {
  if (state.intervalId === null) return;

  clearInterval(state.intervalId);
  state.intervalId = null;
  state.mode = 'paused';
  updateUI();
}

function resetTimer() {
  if (state.intervalId !== null) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }

  state.mode = 'idle';
  state.timeRemaining = WORK_DURATION;
  state.totalTime = WORK_DURATION;
  state.sessionCount = 0;
  updateUI();
}

btnStart.addEventListener('click', startTimer);
btnPause.addEventListener('click', pauseTimer);
btnReset.addEventListener('click', resetTimer);

// Initial render
updateUI();
