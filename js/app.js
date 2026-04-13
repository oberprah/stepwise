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
    items: [
      { name: 'Neck Rolls',            type: 'reps', reps: 10,  duration: 0  },
      { name: 'Pause',                 type: 'pause', duration: 5, reps: 0   },
      { name: 'Shoulder Shrugs',       type: 'reps', reps: 12,  duration: 0  },
      { name: 'Pause',                 type: 'pause', duration: 5, reps: 0   },
      { name: 'Standing Quad Stretch',  type: 'time', reps: 0,   duration: 30 },
      { name: 'Pause',                 type: 'pause', duration: 10, reps: 0  },
      { name: 'Hamstring Stretch',      type: 'time', reps: 0,   duration: 30 },
      { name: 'Pause',                 type: 'pause', duration: 10, reps: 0  },
      { name: 'Cat-Cow Stretch',        type: 'reps', reps: 8,   duration: 0  },
      { name: 'Pause',                 type: 'pause', duration: 5, reps: 0   },
      { name: 'Child\'s Pose',          type: 'time', reps: 0,   duration: 45 },
      { name: 'Pause',                 type: 'pause', duration: 10, reps: 0  },
      { name: 'Seated Spinal Twist',    type: 'time', reps: 0,   duration: 30 },
      { name: 'Pause',                 type: 'pause', duration: 5, reps: 0   },
      { name: 'Deep Breathing',         type: 'time', reps: 0,   duration: 60 },
    ],
  };

  const DEFAULT_ROUTINE_2 = {
    id: 'default-full-body',
    name: 'Full Body Workout',
    items: [
      // Warm-up (standalone)
      { name: 'Jumping Jacks',          type: 'time', reps: 0,  duration: 45 },
      { name: 'Pause',                  type: 'pause', duration: 15, reps: 0 },
      { name: 'High Knees',             type: 'time', reps: 0,  duration: 30 },
      { name: 'Pause',                  type: 'pause', duration: 10, reps: 0 },
      // Upper Body group
      {
        type: 'group', name: 'Upper Body', rounds: 3,
        exercises: [
          { name: 'Push-ups',               type: 'reps', reps: 12, duration: 0 },
          { name: 'Pause',                  type: 'pause', duration: 20, reps: 0 },
          { name: 'Tricep Dips',            type: 'reps', reps: 12, duration: 0 },
          { name: 'Pause',                  type: 'pause', duration: 20, reps: 0 },
          { name: 'Diamond Push-ups',       type: 'reps', reps: 8,  duration: 0 },
          { name: 'Pause',                  type: 'pause', duration: 20, reps: 0 },
        ],
      },
      // Lower Body group
      {
        type: 'group', name: 'Lower Body', rounds: 3,
        exercises: [
          { name: 'Squats',                 type: 'reps', reps: 15, duration: 0 },
          { name: 'Pause',                  type: 'pause', duration: 20, reps: 0 },
          { name: 'Lunges (left leg)',       type: 'reps', reps: 10, duration: 0 },
          { name: 'Pause',                  type: 'pause', duration: 10, reps: 0 },
          { name: 'Lunges (right leg)',      type: 'reps', reps: 10, duration: 0 },
          { name: 'Pause',                  type: 'pause', duration: 20, reps: 0 },
          { name: 'Jump Squats',            type: 'reps', reps: 10, duration: 0 },
          { name: 'Pause',                  type: 'pause', duration: 30, reps: 0 },
        ],
      },
      // Core group
      {
        type: 'group', name: 'Core', rounds: 2,
        exercises: [
          { name: 'Plank',                  type: 'time', reps: 0,  duration: 45 },
          { name: 'Pause',                  type: 'pause', duration: 15, reps: 0 },
          { name: 'Bicycle Crunches',       type: 'reps', reps: 20, duration: 0 },
          { name: 'Pause',                  type: 'pause', duration: 15, reps: 0 },
          { name: 'Leg Raises',             type: 'reps', reps: 12, duration: 0 },
          { name: 'Pause',                  type: 'pause', duration: 15, reps: 0 },
          { name: 'Superman Hold',          type: 'time', reps: 0,  duration: 30 },
          { name: 'Pause',                  type: 'pause', duration: 15, reps: 0 },
        ],
      },
      // Cool down (standalone)
      { name: 'Cool Down Walk',         type: 'time', reps: 0,  duration: 60 },
    ],
  };

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let routines = [];
  let detailRoutineId = null;   // ID of routine in detail screen, null for new
  let detailItems = [];         // Working copy of items (exercises + groups)
  let detailMode = 'edit';      // 'edit' or 'overview'
  let editingExerciseIdx = -1;
  let editingGroupIdx = -1;     // Which group the exercise modal targets (-1 = top-level)
  let editingGroupItemIdx = -1; // Which group is being edited in the group modal (-1 = new)
  let detailSwipeAC = null;     // AbortController for detail list swipe listeners
  let detailDragAC = null;      // AbortController for detail list drag listeners
  let routineSwipeAC = null;    // AbortController for routine list swipe listeners

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
  const exTypePauseBtn      = $('#ex-type-pause');
  const btnModalCancel      = $('#btn-modal-cancel');
  const btnModalSave        = $('#btn-modal-save');

  // Group modal
  const modalGroup          = $('#modal-group');
  const modalGroupTitle     = $('#modal-group-title');
  const groupNameInput      = $('#group-name');
  const groupRoundsInput    = $('#group-rounds');
  const btnGroupCancel      = $('#btn-group-cancel');
  const btnGroupSave        = $('#btn-group-save');

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
      routines.push(
        JSON.parse(JSON.stringify(DEFAULT_ROUTINE)),
        JSON.parse(JSON.stringify(DEFAULT_ROUTINE_2))
      );
      saveRoutines();
      return;
    }
    // Migrate old format: exercises → items
    let migrated = false;
    for (const r of routines) {
      if (r.exercises && !r.items) {
        r.items = r.exercises;
        delete r.exercises;
        migrated = true;
      }
    }
    // Migrate rest → pause exercises
    for (const r of routines) {
      if (!r.items) continue;
      const migrateExercises = (exercises) => {
        const result = [];
        for (const ex of exercises) {
          const rest = ex.rest || 0;
          delete ex.rest;
          result.push(ex);
          if (rest > 0) {
            result.push({ name: 'Pause', type: 'pause', duration: rest, reps: 0 });
          }
        }
        return result;
      };
      let needsMigration = false;
      for (const item of r.items) {
        if ('rest' in item) { needsMigration = true; break; }
        if (item.type === 'group' && item.exercises.some(ex => 'rest' in ex)) { needsMigration = true; break; }
      }
      if (needsMigration) {
        const newItems = [];
        for (const item of r.items) {
          if (item.type === 'group') {
            item.exercises = migrateExercises(item.exercises);
            newItems.push(item);
          } else {
            const rest = item.rest || 0;
            delete item.rest;
            newItems.push(item);
            if (rest > 0) {
              newItems.push({ name: 'Pause', type: 'pause', duration: rest, reps: 0 });
            }
          }
        }
        r.items = newItems;
        migrated = true;
      }
    }
    if (migrated) saveRoutines();
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

    // If returning from Overview to Player during an active session,
    // re-request wake lock in case it was released while Player was hidden.
    if (name === 'player' && currentRoutine) {
      requestWakeLock();
    }
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
    if (ex.type === 'time') return `${ex.duration}s`;
    if (ex.type === 'pause') return `${ex.duration}s pause`;
    return `${ex.reps} reps`;
  }

  // ---------------------------------------------------------------------------
  // Item helpers (groups + exercises)
  // ---------------------------------------------------------------------------

  function flattenItems(items) {
    const result = [];
    for (const item of items) {
      if (item.type === 'group') {
        for (let round = 1; round <= item.rounds; round++) {
          for (const ex of item.exercises) {
            result.push({
              exercise: ex,
              groupName: item.name,
              roundNumber: round,
              totalRounds: item.rounds,
              groupExCount: item.exercises.length,
            });
          }
        }
      } else {
        result.push({
          exercise: item,
          groupName: null,
          roundNumber: null,
          totalRounds: null,
          groupExCount: null,
        });
      }
    }
    return result;
  }

  function countItemStats(items) {
    let exCount = 0;
    let totalSec = 0;
    for (const item of items) {
      if (item.type === 'group') {
        for (const ex of item.exercises) {
          if (ex.type !== 'pause') exCount += item.rounds;
          totalSec += ((ex.type === 'time' || ex.type === 'pause') ? ex.duration : 0) * item.rounds;
        }
      } else {
        if (item.type !== 'pause') exCount++;
        totalSec += (item.type === 'time' || item.type === 'pause') ? item.duration : 0;
      }
    }
    return { exCount, totalSec };
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
      const { exCount, totalSec } = countItemStats(r.items || []);
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

    if (routineSwipeAC) routineSwipeAC.abort();
    routineSwipeAC = new AbortController();
    initSwipe(routineListEl, '.swipe-container', (container) => {
      const id = container.dataset.id;
      const r = routines.find((x) => x.id === id);
      showConfirm(`Delete "${r ? r.name : 'routine'}"?`, () => {
        routines = routines.filter((x) => x.id !== id);
        saveRoutines();
        renderRoutineList();
      });
    }, routineSwipeAC.signal);
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
      detailItems = JSON.parse(JSON.stringify(r.items || r.exercises || []));
    } else {
      detailRoutineId = null;
      detailNameInput.value = '';
      detailItems = [];
    }
    detailNameInput.readOnly = false;
    btnDetailStart.textContent = 'Start';
    btnDetailStart.style.display = '';
    $('#detail-add-buttons').style.display = '';
    renderDetailExercises();
    showScreen('detail');
  }

  function openOverview() {
    if (!currentRoutine) return;
    detailMode = 'overview';
    detailRoutineId = currentRoutine.id;
    detailNameInput.value = currentRoutine.name;
    detailNameInput.readOnly = true;
    detailItems = currentRoutine.items;
    btnDetailStart.textContent = 'Resume';
    btnDetailStart.style.display = '';
    $('#detail-add-buttons').style.display = 'none';
    renderDetailExercises();
    showScreen('detail');
  }

  function renderDetailExercises() {
    const isOverview = detailMode === 'overview';

    if (!isOverview && detailItems.length === 0) {
      detailExerciseList.innerHTML = `
        <div class="empty-state">
          <p>No exercises yet. Tap <strong>+ Add Exercise</strong> or <strong>+ Add Group</strong> below.</p>
        </div>`;
      return;
    }

    if (isOverview) {
      const flat = currentRoutine ? currentRoutine.flatExercises : flattenItems(detailItems);
      let html = '';
      let flatIdx = 0;
      let displayNum = 1;

      for (let i = 0; i < detailItems.length; i++) {
        const item = detailItems[i];

        if (item.type === 'group') {
          const groupSize = item.exercises.length;
          const totalGroupFlat = groupSize * item.rounds;
          const groupStartFlat = flatIdx;
          const groupEndFlat = flatIdx + totalGroupFlat;

          // Determine group status
          let groupDone = currentExIdx >= groupEndFlat;
          let groupActive = currentExIdx >= groupStartFlat && currentExIdx < groupEndFlat;
          let currentRound = groupActive ? Math.floor((currentExIdx - groupStartFlat) / groupSize) + 1 : 0;
          let currentExInGroup = groupActive ? (currentExIdx - groupStartFlat) % groupSize : -1;

          // Group header
          let roundText;
          if (groupDone) {
            roundText = `${item.rounds} rounds done`;
          } else if (groupActive) {
            roundText = `Round ${currentRound} of ${item.rounds}`;
          } else {
            roundText = `${item.rounds} rounds`;
          }

          let headerCls = groupDone ? 'done' : '';
          html += `<div class="group-round-header ${headerCls}">${escapeHtml(item.name)} &middot; ${roundText}</div>`;

          // Group exercises (show once, with status based on current round)
          for (let exIdx = 0; exIdx < item.exercises.length; exIdx++) {
            const ex = item.exercises[exIdx];
            const badge = formatExerciseDetail(ex);
            const pauseCls = ex.type === 'pause' ? ' exercise-item-pause' : '';
            let cls = '';
            if (groupDone) {
              cls = 'done';
            } else if (groupActive) {
              if (exIdx < currentExInGroup) cls = 'done';
              else if (exIdx === currentExInGroup) cls = 'current';
            }
            const statusIcon = cls === 'done' ? ICON_CHECK : (cls === 'current' ? '&#9679;' : '');
            html += `
              <div class="exercise-item overview-group-exercise ${cls}${pauseCls}">
                <div class="exercise-item-content">
                  <span class="exercise-item-status">${statusIcon}</span>
                  <span class="exercise-item-name">${escapeHtml(ex.name)}</span>
                  <span class="exercise-item-badge">${badge}</span>
                </div>
              </div>`;
          }

          flatIdx += totalGroupFlat;
        } else {
          // Standalone exercise
          const badge = formatExerciseDetail(item);
          const pauseCls = item.type === 'pause' ? ' exercise-item-pause' : '';
          let cls = '';
          if (flatIdx < currentExIdx) cls = 'done';
          else if (flatIdx === currentExIdx) cls = 'current';

          const statusIcon = cls === 'done' ? ICON_CHECK : `${displayNum}`;
          html += `
            <div class="exercise-item ${cls}${pauseCls}">
              <div class="exercise-item-content">
                <span class="exercise-item-status">${statusIcon}</span>
                <span class="exercise-item-name">${escapeHtml(item.name)}</span>
                <span class="exercise-item-badge">${badge}</span>
              </div>
            </div>`;
          flatIdx++;
        }
        displayNum++;
      }

      detailExerciseList.innerHTML = html;

      const currentEl = detailExerciseList.querySelector('.exercise-item.current');
      if (currentEl) {
        setTimeout(() => currentEl.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
      }
      return;
    }

    // Edit mode: render items (exercises + groups)
    detailExerciseList.innerHTML = detailItems.map((item, idx) => {
      if (item.type === 'group') {
        const groupExHtml = item.exercises.map((ex, exIdx) => {
          const badge = formatExerciseDetail(ex);
          const pauseCls = ex.type === 'pause' ? ' exercise-item-pause' : '';
          return `
            <div class="exercise-item${pauseCls}" data-group-idx="${idx}" data-ex-idx="${exIdx}">
              <div class="exercise-item-delete">Delete</div>
              <div class="exercise-item-content swipe-content" data-group-idx="${idx}" data-ex-idx="${exIdx}">
                <span class="exercise-item-handle">${ICON_GRIP}</span>
                <span class="exercise-item-name">${escapeHtml(ex.name)}</span>
                <span class="exercise-item-badge">${badge}</span>
              </div>
            </div>`;
        }).join('');

        return `
          <div class="group-container" data-idx="${idx}">
            <div class="group-header" data-idx="${idx}">
              <div class="group-header-delete">Delete</div>
              <div class="group-header-content swipe-content" data-idx="${idx}">
                <span class="exercise-item-handle">${ICON_GRIP}</span>
                <span class="group-header-name">${escapeHtml(item.name)}</span>
                <span class="group-header-rounds">&times;${item.rounds}</span>
              </div>
            </div>
            <div class="group-exercises" data-group-idx="${idx}">
              ${groupExHtml}
            </div>
            <button class="btn-add-group-exercise" data-group-idx="${idx}">+ Add Exercise</button>
          </div>`;
      }

      // Standalone exercise
      const badge = formatExerciseDetail(item);
      const pauseCls = item.type === 'pause' ? ' exercise-item-pause' : '';
      return `
        <div class="exercise-item${pauseCls}" data-idx="${idx}">
          <div class="exercise-item-delete">Delete</div>
          <div class="exercise-item-content swipe-content" data-idx="${idx}">
            <span class="exercise-item-handle">${ICON_GRIP}</span>
            <span class="exercise-item-name">${escapeHtml(item.name)}</span>
            <span class="exercise-item-badge">${badge}</span>
          </div>
        </div>`;
    }).join('');

    initExerciseSwipe();
    initDragReorder();
  }

  function saveDetailRoutine() {
    const name = detailNameInput.value.trim();
    if (!name || detailItems.length === 0) return null;

    if (detailRoutineId) {
      const r = routines.find((x) => x.id === detailRoutineId);
      if (r) {
        r.name = name;
        r.items = JSON.parse(JSON.stringify(detailItems));
        delete r.exercises; // clean up legacy key if present
      }
    } else {
      detailRoutineId = generateId();
      routines.push({
        id: detailRoutineId,
        name,
        items: JSON.parse(JSON.stringify(detailItems)),
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
    if (detailNameInput.value.trim() && detailItems.length > 0) {
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

  function initSwipe(container, itemSelector, onDelete, signal) {
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
    }, { passive: true, signal });

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
    }, { passive: true, signal });

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
    }, { signal });

    // Tap on delete zone
    container.addEventListener('click', (e) => {
      const deleteZone = e.target.closest('.swipe-delete-zone, .exercise-item-delete, .group-header-delete');
      if (!deleteZone) return;
      const item = deleteZone.closest(itemSelector) || deleteZone.parentElement;
      if (item && onDelete) onDelete(item);
    }, { signal });
  }

  // ---------------------------------------------------------------------------
  // Swipe for exercise items in detail screen
  // ---------------------------------------------------------------------------

  function initExerciseSwipe() {
    if (detailSwipeAC) detailSwipeAC.abort();
    detailSwipeAC = new AbortController();

    // Swipe for standalone exercise items and group exercises
    initSwipe(detailExerciseList, '.exercise-item', (item) => {
      const groupIdx = parseInt(item.dataset.groupIdx, 10);
      const exIdx = parseInt(item.dataset.exIdx, 10);

      if (!isNaN(groupIdx) && !isNaN(exIdx)) {
        // Exercise inside a group
        const group = detailItems[groupIdx];
        if (group && group.type === 'group') {
          group.exercises.splice(exIdx, 1);
        }
      } else {
        // Standalone exercise
        const idx = parseInt(item.dataset.idx || item.querySelector('[data-idx]')?.dataset.idx, 10);
        if (isNaN(idx)) return;
        detailItems.splice(idx, 1);
      }
      renderDetailExercises();
    }, detailSwipeAC.signal);

    // Swipe for group headers (delete whole group)
    initSwipe(detailExerciseList, '.group-header', (item) => {
      const idx = parseInt(item.dataset.idx, 10);
      if (isNaN(idx)) return;
      detailItems.splice(idx, 1);
      renderDetailExercises();
    }, detailSwipeAC.signal);
  }

  // ---------------------------------------------------------------------------
  // Drag to reorder exercises
  // ---------------------------------------------------------------------------

  function initDragReorder() {
    if (detailDragAC) detailDragAC.abort();
    detailDragAC = new AbortController();
    const signal = detailDragAC.signal;

    let dragIdx = -1;
    let dragGroupIdx = -1;      // -1 = top-level drag, >= 0 = within-group drag
    let dragExIdx = -1;
    let dragEl = null;
    let placeholder = null;
    let startY = 0;
    let offsetY = 0;
    let itemHeight = 0;
    let dragContainer = null;   // the container we're reordering within

    function cleanupDrag() {
      if (dragEl) {
        dragEl.classList.remove('dragging');
        dragEl.style.cssText = '';
      }
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
      }
      dragEl = null;
      placeholder = null;
      dragIdx = -1;
      dragGroupIdx = -1;
      dragExIdx = -1;
      dragContainer = null;
    }

    detailExerciseList.addEventListener('touchstart', (e) => {
      const handle = e.target.closest('.exercise-item-handle');
      if (!handle) return;

      // Determine if we're inside a group-exercises container
      const groupExContainer = handle.closest('.group-exercises');

      if (groupExContainer) {
        // Within-group drag
        const item = handle.closest('.exercise-item');
        if (!item) return;

        e.preventDefault();
        dragGroupIdx = parseInt(item.dataset.groupIdx, 10);
        dragExIdx = parseInt(item.dataset.exIdx, 10);
        if (isNaN(dragGroupIdx) || isNaN(dragExIdx)) return;

        dragContainer = groupExContainer;
        dragIdx = dragExIdx;

        const rect = item.getBoundingClientRect();
        itemHeight = rect.height;
        startY = e.touches[0].clientY;
        offsetY = startY - rect.top;

        placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = itemHeight + 'px';
        item.parentNode.insertBefore(placeholder, item);

        dragEl = item;
        dragEl.classList.add('dragging');
        dragEl.style.width = rect.width + 'px';
        dragEl.style.left = rect.left + 'px';
        dragEl.style.top = rect.top + 'px';
      } else {
        // Top-level drag (standalone exercise or group container)
        const groupContainer = handle.closest('.group-container');
        const item = groupContainer || handle.closest('.exercise-item');
        if (!item) return;

        e.preventDefault();
        const topIdx = parseInt(item.dataset.idx, 10);
        if (isNaN(topIdx)) return;

        dragContainer = detailExerciseList;
        dragGroupIdx = -1;
        dragExIdx = -1;
        dragIdx = topIdx;

        const rect = item.getBoundingClientRect();
        itemHeight = rect.height;
        startY = e.touches[0].clientY;
        offsetY = startY - rect.top;

        placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.style.height = itemHeight + 'px';
        item.parentNode.insertBefore(placeholder, item);

        dragEl = item;
        dragEl.classList.add('dragging');
        dragEl.style.width = rect.width + 'px';
        dragEl.style.left = rect.left + 'px';
        dragEl.style.top = rect.top + 'px';
      }
    }, { passive: false, signal });

    detailExerciseList.addEventListener('touchmove', (e) => {
      if (!dragEl || !placeholder || !dragContainer) return;
      e.preventDefault();

      const y = e.touches[0].clientY;
      dragEl.style.top = (y - offsetY) + 'px';

      // Determine new position among siblings
      const selector = dragGroupIdx >= 0
        ? '.exercise-item:not(.dragging)'
        : ':scope > .exercise-item:not(.dragging), :scope > .group-container:not(.dragging)';
      const items = [...dragContainer.querySelectorAll(selector)];
      let newIdx = items.length;
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          newIdx = i;
          break;
        }
      }

      if (newIdx >= items.length) {
        dragContainer.appendChild(placeholder);
      } else {
        dragContainer.insertBefore(placeholder, items[newIdx]);
      }
    }, { passive: false, signal });

    detailExerciseList.addEventListener('touchend', () => {
      if (!dragEl || !placeholder || !dragContainer) return;

      const allEls = [...dragContainer.children].filter(
        (el) => !el.classList.contains('dragging') || el === placeholder
      );
      // Remove the dragging element from the count to get correct index
      const allChildren = [...dragContainer.children];
      let newIdx = allChildren.indexOf(placeholder);
      // Adjust: dragging element is still in the list
      if (newIdx > dragIdx) newIdx--;

      // Filter out non-item children (like btn-add-group-exercise)
      // For within-group, only count exercise-items + placeholder
      if (dragGroupIdx >= 0) {
        const relevantEls = allChildren.filter(
          (el) => el.classList.contains('exercise-item') || el.classList.contains('drag-placeholder')
        );
        newIdx = relevantEls.indexOf(placeholder);
        if (newIdx > dragExIdx) newIdx--;

        const group = detailItems[dragGroupIdx];
        if (group && group.type === 'group' && newIdx !== dragExIdx && newIdx >= 0) {
          const [moved] = group.exercises.splice(dragExIdx, 1);
          group.exercises.splice(newIdx, 0, moved);
        }
      } else {
        // Top-level reorder
        if (newIdx !== dragIdx && newIdx >= 0) {
          const [moved] = detailItems.splice(dragIdx, 1);
          detailItems.splice(newIdx, 0, moved);
        }
      }

      // Clean up
      cleanupDrag();
      renderDetailExercises();
    }, { signal });

    detailExerciseList.addEventListener('touchcancel', () => {
      cleanupDrag();
    }, { signal });
  }

  // ---------------------------------------------------------------------------
  // Exercise modal
  // ---------------------------------------------------------------------------

  function openExerciseModal(idx, groupIdx) {
    editingExerciseIdx = idx;
    editingGroupIdx = (groupIdx !== undefined && groupIdx !== null) ? groupIdx : -1;
    const isNew = idx === -1;
    modalExerciseTitle.textContent = isNew ? 'Add Exercise' : 'Edit Exercise';

    if (isNew) {
      exNameInput.value = '';
      setExType('time');
      exDurationInput.value = 30;
      exRepsInput.value = 10;
    } else {
      let ex;
      if (editingGroupIdx >= 0) {
        ex = detailItems[editingGroupIdx].exercises[idx];
      } else {
        ex = detailItems[idx];
      }
      exNameInput.value = ex.name;
      setExType(ex.type);
      exDurationInput.value = ex.duration || 30;
      exRepsInput.value = ex.reps || 10;
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
    exTypeTimeBtn.classList.remove('active');
    exTypeRepsBtn.classList.remove('active');
    exTypePauseBtn.classList.remove('active');

    const nameGroup = exNameInput.closest('.form-group');

    if (type === 'time') {
      exTypeTimeBtn.classList.add('active');
      exDurationGroup.style.display = '';
      exRepsGroup.style.display = 'none';
      nameGroup.style.display = '';
    } else if (type === 'reps') {
      exTypeRepsBtn.classList.add('active');
      exDurationGroup.style.display = 'none';
      exRepsGroup.style.display = '';
      nameGroup.style.display = '';
    } else if (type === 'pause') {
      exTypePauseBtn.classList.add('active');
      exDurationGroup.style.display = '';
      exRepsGroup.style.display = 'none';
      nameGroup.style.display = 'none';
    }
  }

  function saveExerciseFromModal() {
    const type = exTypeTimeBtn.classList.contains('active') ? 'time' :
                 exTypeRepsBtn.classList.contains('active') ? 'reps' : 'pause';
    let name = type === 'pause' ? 'Pause' : exNameInput.value.trim();
    if (!name) {
      exNameInput.focus();
      return;
    }
    const duration = Math.max(5, parseInt(exDurationInput.value, 10) || 30);
    const reps = Math.max(1, parseInt(exRepsInput.value, 10) || 10);

    const ex = {
      name,
      type,
      duration: (type === 'time' || type === 'pause') ? duration : 0,
      reps: type === 'reps' ? reps : 0,
    };

    if (editingGroupIdx >= 0) {
      // Adding/editing inside a group
      const group = detailItems[editingGroupIdx];
      if (editingExerciseIdx === -1) {
        group.exercises.push(ex);
      } else {
        group.exercises[editingExerciseIdx] = ex;
      }
    } else {
      // Top-level exercise
      if (editingExerciseIdx === -1) {
        detailItems.push(ex);
      } else {
        detailItems[editingExerciseIdx] = ex;
      }
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
  // Group modal
  // ---------------------------------------------------------------------------

  function openGroupModal(idx) {
    editingGroupItemIdx = idx;
    const isNew = idx === -1;
    modalGroupTitle.textContent = isNew ? 'Add Group' : 'Edit Group';

    if (isNew) {
      groupNameInput.value = '';
      groupRoundsInput.value = 3;
    } else {
      const group = detailItems[idx];
      groupNameInput.value = group.name;
      groupRoundsInput.value = group.rounds;
    }

    modalGroup.style.display = 'flex';
    document.body.classList.add('modal-open');
    groupNameInput.focus();
  }

  function closeGroupModal() {
    modalGroup.style.display = 'none';
    document.body.classList.remove('modal-open');
  }

  function saveGroupFromModal() {
    const name = groupNameInput.value.trim() || 'Group';
    const rounds = Math.max(2, Math.min(20, parseInt(groupRoundsInput.value, 10) || 3));

    if (editingGroupItemIdx === -1) {
      detailItems.push({
        type: 'group',
        name: name,
        rounds: rounds,
        exercises: [],
      });
    } else {
      const group = detailItems[editingGroupItemIdx];
      group.name = name;
      group.rounds = rounds;
    }

    closeGroupModal();
    renderDetailExercises();
  }

  // ---------------------------------------------------------------------------
  // Player
  // ---------------------------------------------------------------------------

  function startRoutine(routineId) {
    const r = routines.find((x) => x.id === routineId);
    if (!r || !r.items || r.items.length === 0) return;

    ensureAudioCtx();

    currentRoutine = JSON.parse(JSON.stringify(r));
    currentRoutine.flatExercises = flattenItems(currentRoutine.items);
    if (currentRoutine.flatExercises.length === 0) return;

    currentExIdx = 0;
    isPlaying = true;
    routineStartTime = Date.now();

    requestWakeLock();
    playerRoutineName.textContent = currentRoutine.name;
    showScreen('player');
    loadCurrentStep();
    startTimer();
  }

  function loadCurrentStep() {
    const flat = currentRoutine.flatExercises;
    const entry = flat[currentExIdx];
    const ex = entry.exercise;

    // Progress display with group info
    let progressText = `${currentExIdx + 1} of ${flat.length}`;
    if (entry.groupName) {
      progressText += ` \u00B7 ${entry.groupName} R${entry.roundNumber}/${entry.totalRounds}`;
    }
    playerProgress.textContent = progressText;

    // Clear/set pause-phase styling
    playerBody.classList.toggle('pause-phase', ex.type === 'pause');

    // Next exercise preview
    if (currentExIdx + 1 < flat.length) {
      const nextEntry = flat[currentExIdx + 1];
      let nextText = `Next: ${nextEntry.exercise.name}`;
      if (nextEntry.groupName && nextEntry.roundNumber > 1 &&
          (entry.groupName !== nextEntry.groupName || entry.roundNumber !== nextEntry.roundNumber)) {
        nextText += ` (Round ${nextEntry.roundNumber})`;
      }
      playerNext.textContent = nextText;
    } else {
      playerNext.textContent = '';
    }

    if (ex.type === 'pause') {
      playerExerciseName.textContent = ex.name;
      timerLabel.textContent = 'PAUSE';
      timerTypeLabel.textContent = '';
      timeRemaining = ex.duration;
      totalTime = ex.duration;
      btnDoneReps.style.display = 'none';
      btnPlayPause.style.display = 'flex';
      updateTimerDisplay();
      setRingProgress(1);
    } else if (ex.type === 'time') {
      playerExerciseName.textContent = ex.name;
      timerLabel.textContent = 'TIME';
      timerTypeLabel.textContent = '';
      timeRemaining = ex.duration;
      totalTime = ex.duration;
      btnDoneReps.style.display = 'none';
      btnPlayPause.style.display = 'flex';
      updateTimerDisplay();
      setRingProgress(1);
    } else {
      playerExerciseName.textContent = ex.name;
      timerLabel.textContent = 'REPS';
      timerValue.textContent = ex.reps;
      timerTypeLabel.textContent = 'reps';
      timeRemaining = -1;
      totalTime = -1;
      setRingProgress(1);
      btnDoneReps.style.display = '';
      btnPlayPause.style.display = 'none';

      // Rep steps do not have a running countdown, so refresh wake lock
      // when entering them to keep the screen awake throughout the set.
      requestWakeLock();
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

      const ex = currentRoutine.flatExercises[currentExIdx].exercise;
      if (ex.type !== 'pause' && totalTime >= 20) {
        const mid = Math.floor(totalTime / 2);
        if (timeRemaining === mid) beepMidpoint();
      }

      if (timeRemaining <= 0) advanceStep();
    }
  }

  function advanceStep() {
    const flat = currentRoutine.flatExercises;
    currentExIdx++;

    if (currentExIdx >= flat.length) {
      finishRoutine();
      return;
    }

    // Play beep based on what we're advancing to
    const nextEx = flat[currentExIdx].exercise;
    if (nextEx.type === 'pause') {
      beepRest();
    } else {
      beepWork();
    }

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
    const exCount = currentRoutine.flatExercises.length;
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
    $('#btn-detail-add-group').addEventListener('click', () => openGroupModal(-1));

    // Tap on exercise item content or group header to edit (in edit mode)
    detailExerciseList.addEventListener('click', (e) => {
      if (detailMode !== 'edit') return;
      // Don't open editor if tapping delete or handle
      if (e.target.closest('.exercise-item-delete')) return;
      if (e.target.closest('.group-header-delete')) return;
      if (e.target.closest('.exercise-item-handle')) return;

      // "Add Exercise" inside a group
      const addGroupExBtn = e.target.closest('.btn-add-group-exercise');
      if (addGroupExBtn) {
        const groupIdx = parseInt(addGroupExBtn.dataset.groupIdx, 10);
        if (!isNaN(groupIdx)) openExerciseModal(-1, groupIdx);
        return;
      }

      // Tap on group header → open group modal
      const groupHeaderContent = e.target.closest('.group-header-content');
      if (groupHeaderContent) {
        const idx = parseInt(groupHeaderContent.dataset.idx, 10);
        if (!isNaN(idx)) openGroupModal(idx);
        return;
      }

      // Tap on exercise item
      const content = e.target.closest('.exercise-item-content');
      if (content) {
        const groupIdx = parseInt(content.dataset.groupIdx, 10);
        const exIdx = parseInt(content.dataset.exIdx, 10);
        if (!isNaN(groupIdx) && !isNaN(exIdx)) {
          // Exercise inside a group
          openExerciseModal(exIdx, groupIdx);
        } else {
          const idx = parseInt(content.dataset.idx, 10);
          if (!isNaN(idx)) openExerciseModal(idx);
        }
      }
    });

    // --- Exercise modal ---
    exTypeTimeBtn.addEventListener('click', () => setExType('time'));
    exTypeRepsBtn.addEventListener('click', () => setExType('reps'));
    exTypePauseBtn.addEventListener('click', () => setExType('pause'));
    btnModalCancel.addEventListener('click', closeExerciseModal);
    btnModalSave.addEventListener('click', saveExerciseFromModal);
    modalExercise.addEventListener('click', (e) => {
      if (e.target === modalExercise) closeExerciseModal();
    });

    // --- Group modal ---
    btnGroupCancel.addEventListener('click', closeGroupModal);
    btnGroupSave.addEventListener('click', saveGroupFromModal);
    modalGroup.addEventListener('click', (e) => {
      if (e.target === modalGroup) closeGroupModal();
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

  function validateExercise(ex) {
    if (!ex || typeof ex !== 'object') return null;
    if (ex.type !== 'time' && ex.type !== 'reps' && ex.type !== 'pause') return null;
    // Name is optional for pause, required for others
    if (ex.type !== 'pause' && (typeof ex.name !== 'string' || ex.name.trim() === '')) return null;

    const clean = {
      name: ex.type === 'pause' ? 'Pause' : ex.name.trim().slice(0, 60),
      type: ex.type,
      duration: 0,
      reps: 0,
    };

    if (ex.type === 'time' || ex.type === 'pause') {
      const dur = parseInt(ex.duration, 10);
      if (!dur || dur < 5) return null;
      clean.duration = Math.min(600, dur);
    } else {
      const reps = parseInt(ex.reps, 10);
      if (!reps || reps < 1) return null;
      clean.reps = Math.min(200, reps);
    }

    return clean;
  }

  function validateImportedRoutine(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (typeof obj.name !== 'string' || obj.name.trim() === '') return null;

    // Accept items (new format) or exercises (legacy format)
    const rawItems = Array.isArray(obj.items) ? obj.items :
                     Array.isArray(obj.exercises) ? obj.exercises : null;
    if (!rawItems || rawItems.length === 0) return null;

    const cleanItems = [];
    for (const item of rawItems) {
      if (!item || typeof item !== 'object') return null;

      if (item.type === 'group') {
        // Validate group
        if (typeof item.name !== 'string' || item.name.trim() === '') return null;
        const rounds = parseInt(item.rounds, 10);
        if (!rounds || rounds < 2 || rounds > 20) return null;
        if (!Array.isArray(item.exercises) || item.exercises.length === 0) return null;

        const cleanGroupExercises = [];
        for (const ex of item.exercises) {
          const clean = validateExercise(ex);
          if (!clean) return null;
          cleanGroupExercises.push(clean);
        }

        cleanItems.push({
          type: 'group',
          name: item.name.trim().slice(0, 50),
          rounds: rounds,
          exercises: cleanGroupExercises,
        });
      } else {
        // Validate as exercise
        const clean = validateExercise(item);
        if (!clean) return null;
        cleanItems.push(clean);
      }
    }

    return {
      id: generateId(),
      name: obj.name.trim().slice(0, 50),
      items: cleanItems,
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
    currentRoutine.flatExercises = flattenItems(currentRoutine.items);
    if (currentRoutine.flatExercises.length === 0) return;

    currentExIdx = 0;
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
