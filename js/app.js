/* ==========================================================================
   Stepwise – Main Application Logic
   Pure vanilla JS, no dependencies.
   ========================================================================== */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const STORAGE_KEY = 'stretch-timer-routines';
  const CIRCUMFERENCE = 2 * Math.PI * 90;
  const SWIPE_THRESHOLD = 60;

  const DEFAULT_ROUTINE = {
    id: 'default-morning',
    name: 'Morning Stretch',
    exercises: [
      { name: 'Neck Rolls',            type: 'reps', reps: 10,  duration: 0,  rest: 5  },
      { name: 'Shoulder Shrugs',       type: 'reps', reps: 12,  duration: 0,  rest: 5  },
      { name: 'Standing Quad Stretch',  type: 'time', reps: 0,   duration: 30, rest: 10 },
      { name: 'Hamstring Stretch',      type: 'time', reps: 0,   duration: 30, rest: 10 },
      { name: 'Cat-Cow Stretch',        type: 'reps', reps: 8,   duration: 0,  rest: 5  },
      { name: 'Child\'s Pose',          type: 'time', reps: 0,   duration: 45, rest: 10 },
      { name: 'Seated Spinal Twist',    type: 'time', reps: 0,   duration: 30, rest: 5  },
      { name: 'Deep Breathing',         type: 'time', reps: 0,   duration: 60, rest: 0  },
    ],
  };

  const DEFAULT_ROUTINE_2 = {
    id: 'default-full-body',
    name: 'Full Body Workout',
    exercises: [
      { name: 'Jumping Jacks',          type: 'time', reps: 0,  duration: 45, rest: 15 },
      { name: 'High Knees',             type: 'time', reps: 0,  duration: 30, rest: 10 },
      { name: 'Push-ups',               type: 'reps', reps: 12, duration: 0,  rest: 20 },
      { name: 'Squats',                 type: 'reps', reps: 15, duration: 0,  rest: 20 },
      { name: 'Plank',                  type: 'time', reps: 0,  duration: 45, rest: 15 },
      { name: 'Lunges (left leg)',       type: 'reps', reps: 10, duration: 0,  rest: 10 },
      { name: 'Lunges (right leg)',      type: 'reps', reps: 10, duration: 0,  rest: 20 },
      { name: 'Burpees',                type: 'reps', reps: 8,  duration: 0,  rest: 30 },
      { name: 'Mountain Climbers',      type: 'time', reps: 0,  duration: 30, rest: 15 },
      { name: 'Tricep Dips',            type: 'reps', reps: 12, duration: 0,  rest: 20 },
      { name: 'Glute Bridges',          type: 'reps', reps: 15, duration: 0,  rest: 15 },
      { name: 'Side Plank (left)',       type: 'time', reps: 0,  duration: 30, rest: 10 },
      { name: 'Side Plank (right)',      type: 'time', reps: 0,  duration: 30, rest: 20 },
      { name: 'Superman Hold',          type: 'time', reps: 0,  duration: 30, rest: 15 },
      { name: 'Bicycle Crunches',       type: 'reps', reps: 20, duration: 0,  rest: 15 },
      { name: 'Jump Squats',            type: 'reps', reps: 10, duration: 0,  rest: 30 },
      { name: 'Inchworms',              type: 'reps', reps: 8,  duration: 0,  rest: 15 },
      { name: 'Push-ups (wide grip)',   type: 'reps', reps: 10, duration: 0,  rest: 20 },
      { name: 'Wall Sit',               type: 'time', reps: 0,  duration: 45, rest: 20 },
      { name: 'Reverse Crunches',       type: 'reps', reps: 15, duration: 0,  rest: 15 },
      { name: 'Lateral Shuffles',       type: 'time', reps: 0,  duration: 30, rest: 15 },
      { name: 'Diamond Push-ups',       type: 'reps', reps: 8,  duration: 0,  rest: 20 },
      { name: 'Squat Hold',             type: 'time', reps: 0,  duration: 30, rest: 15 },
      { name: 'Leg Raises',             type: 'reps', reps: 12, duration: 0,  rest: 15 },
      { name: 'Bear Crawl',             type: 'time', reps: 0,  duration: 20, rest: 15 },
      { name: 'Hip Circles',            type: 'reps', reps: 10, duration: 0,  rest: 10 },
      { name: 'Calf Raises',            type: 'reps', reps: 20, duration: 0,  rest: 10 },
      { name: 'Donkey Kicks (left)',     type: 'reps', reps: 12, duration: 0,  rest: 10 },
      { name: 'Donkey Kicks (right)',    type: 'reps', reps: 12, duration: 0,  rest: 15 },
      { name: 'Cool Down Walk',         type: 'time', reps: 0,  duration: 60, rest: 0  },
    ],
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let routines = [];
  let detailRoutineId = null;   // ID of routine in detail screen, null for new
  let detailExercises = [];     // Working copy of exercises
  let detailMode = 'edit';      // 'edit' or 'overview'
  let editingExerciseIdx = -1;

  // Wake lock
  let wakeLock = null;

  async function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
        if (document.visibilityState === 'visible' && screens.player.classList.contains('active')) {
          requestWakeLock();
        }
      });
    } catch (_) { /* denied or unavailable */ }
  }

  function releaseWakeLock() {
    if (wakeLock) {
      wakeLock.release();
      wakeLock = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && screens.player.classList.contains('active')) {
      requestWakeLock();
    }
  });

  // Player state
  let currentRoutine = null;
  let currentExIdx = 0;
  let isRestPhase = false;
  let timeRemaining = 0;
  let totalTime = 0;
  let isPlaying = false;
  let timerInterval = null;
  let routineStartTime = null;
  let isEphemeralSession = false;

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    list:     $('#screen-list'),
    detail:   $('#screen-detail'),
    player:   $('#screen-player'),
    complete: $('#screen-complete'),
  };

  // List screen
  const routineListEl       = $('#routine-list');
  const btnNewRoutine       = $('#btn-new-routine');

  // Detail screen
  const btnDetailBack       = $('#btn-detail-back');
  const btnDetailStart      = $('#btn-detail-start');
  const detailNameInput     = $('#detail-routine-name');
  const detailExerciseList  = $('#detail-exercise-list');
  const btnDetailAdd        = $('#btn-detail-add');

  // Player screen
  const btnPlayerBack       = $('#btn-player-back');
  const btnPlayerOverview   = $('#btn-player-overview');
  const playerRoutineName   = $('#player-routine-name');
  const playerProgress      = $('#player-progress');
  const timerRingProgress   = $('#timer-ring-progress');
  const timerLabel          = $('#timer-label');
  const timerValue          = $('#timer-value');
  const timerTypeLabel      = $('#timer-type-label');
  const playerExerciseName  = $('#player-exercise-name');
  const playerNext          = $('#player-next');
  const btnPlayPause        = $('#btn-play-pause');
  const iconPlay            = $('#icon-play');
  const iconPause           = $('#icon-pause');
  const btnSkip             = $('#btn-skip');
  const btnDoneReps         = $('#btn-done-reps');
  const playerBody          = $('.player-body');

  // Complete screen
  const completeSummary     = $('#complete-summary');
  const btnCompleteBack     = $('#btn-complete-back');

  // Exercise modal
  const modalExercise       = $('#modal-exercise');
  const modalExerciseTitle  = $('#modal-exercise-title');
  const exNameInput         = $('#ex-name');
  const exTypeTimeBtn       = $('#ex-type-time');
  const exTypeRepsBtn       = $('#ex-type-reps');
  const exDurationGroup     = $('#ex-duration-group');
  const exRepsGroup         = $('#ex-reps-group');
  const exDurationInput     = $('#ex-duration');
  const exRepsInput         = $('#ex-reps');
  const exRestInput         = $('#ex-rest');
  const btnModalCancel      = $('#btn-modal-cancel');
  const btnModalSave        = $('#btn-modal-save');

  // Confirm modal
  const modalConfirm        = $('#modal-confirm');
  const confirmMessage      = $('#confirm-message');
  const btnConfirmCancel    = $('#btn-confirm-cancel');
  const btnConfirmOk        = $('#btn-confirm-ok');

  // ---------------------------------------------------------------------------
  // SVG icons (reused in templates)
  // ---------------------------------------------------------------------------

  const ICON_GRIP = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.5"/><circle cx="11" cy="3" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="11" cy="8" r="1.5"/><circle cx="5" cy="13" r="1.5"/><circle cx="11" cy="13" r="1.5"/></svg>`;
  const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const ICON_CHEVRON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  let audioCtx = null;
  let suspendTimer = null;

  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if ('audioSession' in navigator) {
        navigator.audioSession.type = 'transient';
      }
    }
    if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
      audioCtx.resume();
    }
    clearTimeout(suspendTimer);
  }

  function scheduleSuspend(delayMs) {
    clearTimeout(suspendTimer);
    suspendTimer = setTimeout(() => {
      if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
    }, delayMs);
  }

  function beep(freq = 880, dur = 0.15) {
    try {
      ensureAudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + dur);
      scheduleSuspend((dur + 0.1) * 1000);
    } catch (_) {}
  }

  function beepComplete() {
    beep(880, 0.15);
    setTimeout(() => beep(880, 0.15), 250);
    setTimeout(() => beep(1200, 0.3), 500);
    scheduleSuspend(900);
  }

  function beepWork() {
    beep(660, 0.12);
    setTimeout(() => beep(880, 0.12), 180);
    setTimeout(() => beep(1100, 0.18), 360);
    scheduleSuspend(650);
  }

  function beepRest() {
    beep(440, 0.15);
    setTimeout(() => beep(440, 0.15), 250);
    scheduleSuspend(500);
  }

  function beepMidpoint() {
    beep(660, 0.25);
  }

  // ---------------------------------------------------------------------------
  // Data – localStorage
  // ---------------------------------------------------------------------------

  function loadRoutines() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      routines = raw ? JSON.parse(raw) : [];
    } catch (_) {
      routines = [];
    }
    if (routines.length === 0) {
      routines.push({ ...DEFAULT_ROUTINE }, { ...DEFAULT_ROUTINE_2 });
      saveRoutines();
    }
  }

  function saveRoutines() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(routines));
  }

  function generateId() {
    return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ---------------------------------------------------------------------------
  // Screen navigation
  // ---------------------------------------------------------------------------

  function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatExerciseDetail(ex) {
    return ex.type === 'time' ? `${ex.duration}s` : `${ex.reps} reps`;
  }

  // ---------------------------------------------------------------------------
  // Routine List rendering
  // ---------------------------------------------------------------------------

  function renderRoutineList() {
    if (routines.length === 0) {
      routineListEl.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p>No routines yet.<br>Tap <strong>+</strong> to create one.</p>
        </div>`;
      return;
    }

    routineListEl.innerHTML = routines.map((r) => {
      const exCount = r.exercises.length;
      const totalSec = r.exercises.reduce((sum, e) =>
        sum + (e.type === 'time' ? e.duration : 0) + (e.rest || 0), 0);
      const mins = Math.ceil(totalSec / 60);

      return `
        <div class="swipe-container" data-id="${r.id}">
          <div class="swipe-delete-zone">Delete</div>
          <div class="routine-card swipe-content" data-id="${r.id}">
            <div class="routine-card-info">
              <div class="routine-card-name">${escapeHtml(r.name)}</div>
              <div class="routine-card-meta">${exCount} exercise${exCount !== 1 ? 's' : ''} &middot; ~${mins} min</div>
            </div>
            <span class="routine-card-chevron">${ICON_CHEVRON}</span>
          </div>
        </div>`;
    }).join('');

    initSwipe(routineListEl, '.swipe-container', (container) => {
      const id = container.dataset.id;
      const r = routines.find((x) => x.id === id);
      showConfirm(`Delete "${r ? r.name : 'routine'}"?`, () => {
        routines = routines.filter((x) => x.id !== id);
        saveRoutines();
        renderRoutineList();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Detail screen (combined editor + overview)
  // ---------------------------------------------------------------------------

  function openDetail(routineId) {
    detailMode = 'edit';
    if (routineId) {
      const r = routines.find((x) => x.id === routineId);
      if (!r) return;
      detailRoutineId = routineId;
      detailNameInput.value = r.name;
      detailExercises = JSON.parse(JSON.stringify(r.exercises));
    } else {
      detailRoutineId = null;
      detailNameInput.value = '';
      detailExercises = [];
    }
    detailNameInput.readOnly = false;
    btnDetailStart.textContent = 'Start';
    btnDetailStart.style.display = '';
    btnDetailAdd.style.display = '';
    renderDetailExercises();
    showScreen('detail');
  }

  function openOverview() {
    if (!currentRoutine) return;
    detailMode = 'overview';
    detailRoutineId = currentRoutine.id;
    detailNameInput.value = currentRoutine.name;
    detailNameInput.readOnly = true;
    detailExercises = currentRoutine.exercises;
    btnDetailStart.textContent = 'Resume';
    btnDetailStart.style.display = '';
    btnDetailAdd.style.display = 'none';
    renderDetailExercises();
    showScreen('detail');
  }

  function renderDetailExercises() {
    const isOverview = detailMode === 'overview';

    if (!isOverview && detailExercises.length === 0) {
      detailExerciseList.innerHTML = `
        <div class="empty-state">
          <p>No exercises yet. Tap <strong>+ Add Exercise</strong> below.</p>
        </div>`;
      return;
    }

    detailExerciseList.innerHTML = detailExercises.map((ex, idx) => {
      const badge = formatExerciseDetail(ex);

      if (isOverview) {
        let cls = '';
        if (idx < currentExIdx) cls = 'done';
        else if (idx === currentExIdx) cls = 'current';

        const statusIcon = idx < currentExIdx ? ICON_CHECK : `${idx + 1}`;

        return `
          <div class="exercise-item ${cls}" data-idx="${idx}">
            <div class="exercise-item-content">
              <span class="exercise-item-status">${statusIcon}</span>
              <span class="exercise-item-name">${escapeHtml(ex.name)}</span>
              <span class="exercise-item-badge">${badge}</span>
            </div>
          </div>`;
      }

      return `
        <div class="exercise-item" data-idx="${idx}">
          <div class="exercise-item-delete">Delete</div>
          <div class="exercise-item-content swipe-content" data-idx="${idx}">
            <span class="exercise-item-handle">${ICON_GRIP}</span>
            <span class="exercise-item-name">${escapeHtml(ex.name)}</span>
            <span class="exercise-item-badge">${badge}</span>
          </div>
        </div>`;
    }).join('');

    if (!isOverview) {
      initExerciseSwipe();
      initDragReorder();
    }

    // Scroll current exercise into view in overview
    if (isOverview) {
      const currentEl = detailExerciseList.querySelector('.exercise-item.current');
      if (currentEl) {
        setTimeout(() => currentEl.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
      }
    }
  }

  function saveDetailRoutine() {
    const name = detailNameInput.value.trim();
    if (!name || detailExercises.length === 0) return null;

    if (detailRoutineId) {
      const r = routines.find((x) => x.id === detailRoutineId);
      if (r) {
        r.name = name;
        r.exercises = JSON.parse(JSON.stringify(detailExercises));
      }
    } else {
      detailRoutineId = generateId();
      routines.push({
        id: detailRoutineId,
        name,
        exercises: JSON.parse(JSON.stringify(detailExercises)),
      });
    }
    saveRoutines();
    renderRoutineList();
    return detailRoutineId;
  }

  function detailBack() {
    if (detailMode === 'overview') {
      showScreen('player');
      return;
    }
    // Auto-save on back if there's content
    if (detailNameInput.value.trim() && detailExercises.length > 0) {
      saveDetailRoutine();
    }
    showScreen('list');
  }

  function detailStart() {
    if (detailMode === 'overview') {
      showScreen('player');
      return;
    }
    const id = saveDetailRoutine();
    if (id) startRoutine(id);
  }

  // ---------------------------------------------------------------------------
  // Swipe to delete (generic)
  // ---------------------------------------------------------------------------

  function initSwipe(container, itemSelector, onDelete) {
    let startX = 0;
    let startY = 0;
    let currentContent = null;
    let currentContainer = null;
    let isTracking = false;
    let isHorizontal = null;

    container.addEventListener('touchstart', (e) => {
      const item = e.target.closest(itemSelector);
      if (!item) return;
      // Don't swipe from drag handles
      if (e.target.closest('.exercise-item-handle')) return;

      currentContainer = item;
      currentContent = item.querySelector('.swipe-content');
      if (!currentContent) return;

      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isTracking = true;
      isHorizontal = null;

      // Reset any other open swipes
      container.querySelectorAll('.swipe-content').forEach((el) => {
        if (el !== currentContent) {
          el.style.transform = '';
          el.classList.remove('swiping');
        }
      });
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!isTracking || !currentContent) return;

      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      // Determine scroll direction on first significant move
      if (isHorizontal === null) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          isHorizontal = Math.abs(dx) > Math.abs(dy);
        }
        return;
      }

      if (!isHorizontal) return;

      currentContent.classList.add('swiping');
      const clamped = Math.max(Math.min(dx, 0), -120);
      currentContent.style.transform = `translateX(${clamped}px)`;
    }, { passive: true });

    container.addEventListener('touchend', (e) => {
      if (!isTracking || !currentContent) return;
      isTracking = false;

      const dx = e.changedTouches[0].clientX - startX;
      currentContent.classList.remove('swiping');

      if (dx < -SWIPE_THRESHOLD) {
        // Show delete zone
        currentContent.style.transform = `translateX(-90px)`;
      } else {
        currentContent.style.transform = '';
      }
      currentContent = null;
    });

    // Tap on delete zone
    container.addEventListener('click', (e) => {
      const deleteZone = e.target.closest('.swipe-delete-zone, .exercise-item-delete');
      if (!deleteZone) return;
      const item = deleteZone.closest(itemSelector) || deleteZone.parentElement;
      if (item && onDelete) onDelete(item);
    });
  }

  // ---------------------------------------------------------------------------
  // Swipe for exercise items in detail screen
  // ---------------------------------------------------------------------------

  function initExerciseSwipe() {
    // Re-bind swipe for exercise items
    initSwipe(detailExerciseList, '.exercise-item', (item) => {
      const idx = parseInt(item.dataset.idx || item.querySelector('[data-idx]')?.dataset.idx, 10);
      if (isNaN(idx)) return;
      detailExercises.splice(idx, 1);
      renderDetailExercises();
    });
  }

  // ---------------------------------------------------------------------------
  // Drag to reorder exercises
  // ---------------------------------------------------------------------------

  function initDragReorder() {
    let dragIdx = -1;
    let dragEl = null;
    let placeholder = null;
    let startY = 0;
    let offsetY = 0;
    let itemHeight = 0;
    let containerRect = null;

    detailExerciseList.addEventListener('touchstart', (e) => {
      const handle = e.target.closest('.exercise-item-handle');
      if (!handle) return;

      const item = handle.closest('.exercise-item');
      if (!item) return;

      e.preventDefault();
      dragIdx = parseInt(item.dataset.idx || item.querySelector('[data-idx]')?.dataset.idx, 10);
      if (isNaN(dragIdx)) return;

      const rect = item.getBoundingClientRect();
      containerRect = detailExerciseList.getBoundingClientRect();
      itemHeight = rect.height;
      startY = e.touches[0].clientY;
      offsetY = startY - rect.top;

      // Create placeholder
      placeholder = document.createElement('div');
      placeholder.className = 'drag-placeholder';
      placeholder.style.height = itemHeight + 'px';
      item.parentNode.insertBefore(placeholder, item);

      // Make item fixed/floating
      dragEl = item;
      dragEl.classList.add('dragging');
      dragEl.style.width = rect.width + 'px';
      dragEl.style.left = rect.left + 'px';
      dragEl.style.top = rect.top + 'px';
    }, { passive: false });

    detailExerciseList.addEventListener('touchmove', (e) => {
      if (!dragEl || !placeholder) return;
      e.preventDefault();

      const y = e.touches[0].clientY;
      dragEl.style.top = (y - offsetY) + 'px';

      // Determine new position
      const items = [...detailExerciseList.querySelectorAll('.exercise-item:not(.dragging)')];
      let newIdx = items.length;
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          newIdx = i;
          break;
        }
      }

      // Move placeholder
      if (newIdx >= items.length) {
        detailExerciseList.appendChild(placeholder);
      } else {
        detailExerciseList.insertBefore(placeholder, items[newIdx]);
      }
    }, { passive: false });

    detailExerciseList.addEventListener('touchend', () => {
      if (!dragEl || !placeholder) return;

      // Find where placeholder ended up
      const allEls = [...detailExerciseList.children];
      let newIdx = allEls.indexOf(placeholder);
      // Adjust: dragging element is still in the list
      if (newIdx > dragIdx) newIdx--;

      // Reorder the data
      if (newIdx !== dragIdx && newIdx >= 0) {
        const [moved] = detailExercises.splice(dragIdx, 1);
        detailExercises.splice(newIdx, 0, moved);
      }

      // Clean up
      dragEl.classList.remove('dragging');
      dragEl.style.cssText = '';
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      dragEl = null;
      placeholder = null;
      dragIdx = -1;

      renderDetailExercises();
    });
  }

  // ---------------------------------------------------------------------------
  // Exercise modal
  // ---------------------------------------------------------------------------

  function openExerciseModal(idx) {
    editingExerciseIdx = idx;
    const isNew = idx === -1;
    modalExerciseTitle.textContent = isNew ? 'Add Exercise' : 'Edit Exercise';

    if (isNew) {
      exNameInput.value = '';
      setExType('time');
      exDurationInput.value = 30;
      exRepsInput.value = 10;
      exRestInput.value = 0;
    } else {
      const ex = detailExercises[idx];
      exNameInput.value = ex.name;
      setExType(ex.type);
      exDurationInput.value = ex.duration || 30;
      exRepsInput.value = ex.reps || 10;
      exRestInput.value = ex.rest || 0;
    }

    modalExercise.style.display = 'flex';
    document.body.classList.add('modal-open');
    exNameInput.focus();
  }

  function closeExerciseModal() {
    modalExercise.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  function setExType(type) {
    if (type === 'time') {
      exTypeTimeBtn.classList.add('active');
      exTypeRepsBtn.classList.remove('active');
      exDurationGroup.style.display = '';
      exRepsGroup.style.display = 'none';
    } else {
      exTypeRepsBtn.classList.add('active');
      exTypeTimeBtn.classList.remove('active');
      exDurationGroup.style.display = 'none';
      exRepsGroup.style.display = '';
    }
  }

  function saveExerciseFromModal() {
    const name = exNameInput.value.trim();
    if (!name) {
      exNameInput.focus();
      return;
    }
    const type = exTypeTimeBtn.classList.contains('active') ? 'time' : 'reps';
    const duration = Math.max(5, parseInt(exDurationInput.value, 10) || 30);
    const reps = Math.max(1, parseInt(exRepsInput.value, 10) || 10);
    const rest = Math.max(0, parseInt(exRestInput.value, 10) || 0);

    const ex = {
      name,
      type,
      duration: type === 'time' ? duration : 0,
      reps: type === 'reps' ? reps : 0,
      rest,
    };

    if (editingExerciseIdx === -1) {
      detailExercises.push(ex);
    } else {
      detailExercises[editingExerciseIdx] = ex;
    }

    closeExerciseModal();
    renderDetailExercises();
  }

  // ---------------------------------------------------------------------------
  // Confirm modal
  // ---------------------------------------------------------------------------

  let confirmCallback = null;

  function showConfirm(msg, onConfirm) {
    confirmMessage.textContent = msg;
    confirmCallback = onConfirm;
    modalConfirm.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  function closeConfirm() {
    modalConfirm.style.display = 'none';
    document.body.classList.remove('modal-open');
    confirmCallback = null;
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------

  function startRoutine(routineId) {
    const r = routines.find((x) => x.id === routineId);
    if (!r || r.exercises.length === 0) return;

    ensureAudioCtx();

    currentRoutine = JSON.parse(JSON.stringify(r));
    currentExIdx = 0;
    isRestPhase = false;
    isPlaying = true;
    routineStartTime = Date.now();

    requestWakeLock();
    playerRoutineName.textContent = currentRoutine.name;
    showScreen('player');
    loadCurrentStep();
    startTimer();
  }

  function loadCurrentStep() {
    const exercises = currentRoutine.exercises;
    const ex = exercises[currentExIdx];

    playerProgress.textContent = `${currentExIdx + 1} of ${exercises.length}`;
    playerBody.classList.toggle('rest-phase', isRestPhase);

    if (isRestPhase) {
      playerExerciseName.textContent = 'REST';
      timerLabel.textContent = 'REST';
      timerTypeLabel.textContent = '';
      timeRemaining = ex.rest;
      totalTime = ex.rest;

      const nextIdx = currentExIdx + 1;
      playerNext.textContent = nextIdx < exercises.length
        ? `Next: ${exercises[nextIdx].name}` : '';

      btnDoneReps.style.display = 'none';
      btnPlayPause.style.display = 'flex';
      updateTimerDisplay();
      setRingProgress(1);
    } else {
      playerExerciseName.textContent = ex.name;

      const hasRest = ex.rest > 0;
      if (!hasRest && currentExIdx + 1 < exercises.length) {
        playerNext.textContent = `Next: ${exercises[currentExIdx + 1].name}`;
      } else if (hasRest) {
        playerNext.textContent = `${ex.rest}s rest after this`;
      } else {
        playerNext.textContent = '';
      }

      if (ex.type === 'time') {
        timerLabel.textContent = 'TIME';
        timerTypeLabel.textContent = '';
        timeRemaining = ex.duration;
        totalTime = ex.duration;
        btnDoneReps.style.display = 'none';
        btnPlayPause.style.display = 'flex';
        updateTimerDisplay();
        setRingProgress(1);
      } else {
        timerLabel.textContent = 'REPS';
        timerValue.textContent = ex.reps;
        timerTypeLabel.textContent = 'reps';
        timeRemaining = -1;
        totalTime = -1;
        setRingProgress(1);
        btnDoneReps.style.display = '';
        btnPlayPause.style.display = 'none';
      }
    }

    updatePlayPauseIcon();
  }

  function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(tick, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function tick() {
    if (!isPlaying) return;
    if (timeRemaining <= 0 && totalTime > 0) {
      advanceStep();
      return;
    }
    if (totalTime > 0) {
      timeRemaining--;
      updateTimerDisplay();
      setRingProgress(timeRemaining / totalTime);

      if (!isRestPhase && totalTime >= 20) {
        const mid = Math.floor(totalTime / 2);
        if (timeRemaining === mid) beepMidpoint();
      }

      if (timeRemaining <= 0) advanceStep();
    }
  }

  function advanceStep() {
    const exercises = currentRoutine.exercises;
    const ex = exercises[currentExIdx];

    if (!isRestPhase && ex.rest > 0) {
      isRestPhase = true;
      beepRest();
      loadCurrentStep();
      return;
    }

    isRestPhase = false;
    currentExIdx++;

    if (currentExIdx >= exercises.length) {
      finishRoutine();
      return;
    }

    beepWork();
    loadCurrentStep();
  }

  function finishRoutine() {
    stopTimer();
    isPlaying = false;
    releaseWakeLock();
    beepComplete();

    const elapsed = Math.round((Date.now() - routineStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const exCount = currentRoutine.exercises.length;
    completeSummary.textContent = `${exCount} exercises completed in ${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

    showScreen('complete');
  }

  function togglePlayPause() {
    isPlaying = !isPlaying;
    updatePlayPauseIcon();
    if (isPlaying) {
      requestWakeLock();
      if (!timerInterval) startTimer();
    }
  }

  function updatePlayPauseIcon() {
    iconPlay.style.display = isPlaying ? 'none' : '';
    iconPause.style.display = isPlaying ? '' : 'none';
  }

  function skipStep() {
    beep(660, 0.1);
    advanceStep();
  }

  function exitPlayer() {
    stopTimer();
    isPlaying = false;
    releaseWakeLock();
    currentRoutine = null;
    if (isEphemeralSession) {
      window.location.href = window.location.pathname;
      return;
    }
    showScreen('list');
  }

  // ---------------------------------------------------------------------------
  // Timer display helpers
  // ---------------------------------------------------------------------------

  function updateTimerDisplay() {
    if (timeRemaining < 0) return;
    const m = Math.floor(timeRemaining / 60);
    const s = timeRemaining % 60;
    timerValue.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function setRingProgress(fraction) {
    const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
    timerRingProgress.style.strokeDashoffset = offset;
  }

  // ---------------------------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------------------------

  function bindEvents() {
    // --- List screen ---
    btnNewRoutine.addEventListener('click', () => openDetail(null));

    routineListEl.addEventListener('click', (e) => {
      // Ignore if tapping delete zone
      if (e.target.closest('.swipe-delete-zone')) return;
      const card = e.target.closest('.routine-card');
      if (card) openDetail(card.dataset.id);
    });

    // --- Detail screen ---
    btnDetailBack.addEventListener('click', detailBack);
    btnDetailStart.addEventListener('click', detailStart);
    btnDetailAdd.addEventListener('click', () => openExerciseModal(-1));

    // Tap on exercise item content to edit (in edit mode)
    detailExerciseList.addEventListener('click', (e) => {
      if (detailMode !== 'edit') return;
      // Don't open editor if tapping delete or handle
      if (e.target.closest('.exercise-item-delete')) return;
      if (e.target.closest('.exercise-item-handle')) return;
      const content = e.target.closest('.exercise-item-content');
      if (content) {
        const idx = parseInt(content.dataset.idx, 10);
        if (!isNaN(idx)) openExerciseModal(idx);
      }
    });

    // --- Exercise modal ---
    exTypeTimeBtn.addEventListener('click', () => setExType('time'));
    exTypeRepsBtn.addEventListener('click', () => setExType('reps'));
    btnModalCancel.addEventListener('click', closeExerciseModal);
    btnModalSave.addEventListener('click', saveExerciseFromModal);
    modalExercise.addEventListener('click', (e) => {
      if (e.target === modalExercise) closeExerciseModal();
    });

    // --- Confirm modal ---
    btnConfirmCancel.addEventListener('click', closeConfirm);
    btnConfirmOk.addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirm();
    });
    modalConfirm.addEventListener('click', (e) => {
      if (e.target === modalConfirm) closeConfirm();
    });

    // --- Player screen ---
    btnPlayerBack.addEventListener('click', exitPlayer);
    btnPlayerOverview.addEventListener('click', openOverview);
    btnPlayPause.addEventListener('click', togglePlayPause);
    btnSkip.addEventListener('click', skipStep);
    btnDoneReps.addEventListener('click', () => {
      beep(880, 0.15);
      advanceStep();
    });

    // --- Complete screen ---
    btnCompleteBack.addEventListener('click', () => {
      if (isEphemeralSession) {
        window.location.href = window.location.pathname;
        return;
      }
      showScreen('list');
    });

    // --- Keyboard shortcuts ---
    document.addEventListener('keydown', (e) => {
      if (screens.player.classList.contains('active')) {
        if (e.code === 'Space') {
          e.preventDefault();
          if (totalTime === -1) {
            beep(880, 0.15);
            advanceStep();
          } else {
            togglePlayPause();
          }
        }
        if (e.code === 'ArrowRight') {
          e.preventDefault();
          skipStep();
        }
        if (e.code === 'Escape') {
          e.preventDefault();
          exitPlayer();
        }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // URL parameter handling
  // ---------------------------------------------------------------------------

  function validateImportedRoutine(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (typeof obj.name !== 'string' || obj.name.trim() === '') return null;
    if (!Array.isArray(obj.exercises) || obj.exercises.length === 0) return null;

    const cleanExercises = [];
    for (const ex of obj.exercises) {
      if (!ex || typeof ex !== 'object') return null;
      if (typeof ex.name !== 'string' || ex.name.trim() === '') return null;
      if (ex.type !== 'time' && ex.type !== 'reps') return null;

      const clean = {
        name: ex.name.trim().slice(0, 60),
        type: ex.type,
        duration: 0,
        reps: 0,
        rest: Math.max(0, Math.min(120, parseInt(ex.rest, 10) || 0)),
      };

      if (ex.type === 'time') {
        const dur = parseInt(ex.duration, 10);
        if (!dur || dur < 5) return null;
        clean.duration = Math.min(600, dur);
      } else {
        const reps = parseInt(ex.reps, 10);
        if (!reps || reps < 1) return null;
        clean.reps = Math.min(200, reps);
      }

      cleanExercises.push(clean);
    }

    return {
      id: generateId(),
      name: obj.name.trim().slice(0, 50),
      exercises: cleanExercises,
    };
  }

  function parseRoutineFromURL() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('routine');
    if (!encoded) return null;

    try {
      const json = atob(encoded);
      const obj = JSON.parse(json);
      const routine = validateImportedRoutine(obj);
      if (!routine) {
        console.warn('Stepwise: imported routine failed validation');
        return null;
      }
      return routine;
    } catch (e) {
      console.warn('Stepwise: failed to decode/parse routine from URL', e);
      return null;
    }
  }

  function startEphemeralRoutine(routine) {
    ensureAudioCtx();
    isEphemeralSession = true;

    currentRoutine = JSON.parse(JSON.stringify(routine));
    currentExIdx = 0;
    isRestPhase = false;
    isPlaying = true;
    routineStartTime = Date.now();

    requestWakeLock();
    playerRoutineName.textContent = currentRoutine.name;
    showScreen('player');
    loadCurrentStep();
    startTimer();
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    loadRoutines();
    renderRoutineList();
    bindEvents();

    const importedRoutine = parseRoutineFromURL();
    if (importedRoutine) {
      showScreen('list');
      startEphemeralRoutine(importedRoutine);
    } else {
      showScreen('list');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
