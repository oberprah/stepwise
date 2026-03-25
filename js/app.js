/* ==========================================================================
   Stretch Timer – Main Application Logic
   Pure vanilla JS, no dependencies.
   ========================================================================== */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  const STORAGE_KEY = 'stretch-timer-routines';
  const CIRCUMFERENCE = 2 * Math.PI * 90; // matches SVG circle r=90

  // Pre-built example routine
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

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  let routines = [];         // Array of routine objects
  let editingRoutineId = null; // ID of routine being edited, or null for new
  let editorExercises = [];  // Temporary exercise list while editing
  let editingExerciseIdx = -1; // Index of exercise being edited in modal (-1 = new)

  // Player state
  let currentRoutine = null;
  let currentExIdx = 0;
  let isRestPhase = false;
  let timeRemaining = 0;
  let totalTime = 0;
  let isPlaying = false;
  let timerInterval = null;
  let routineStartTime = null;

  // ---------------------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------------------

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const screens = {
    list:     $('#screen-list'),
    editor:   $('#screen-editor'),
    player:   $('#screen-player'),
    complete: $('#screen-complete'),
  };

  // List screen
  const routineListEl       = $('#routine-list');
  const btnNewRoutine       = $('#btn-new-routine');

  // Editor screen
  const btnEditorBack       = $('#btn-editor-back');
  const btnSaveRoutine      = $('#btn-save-routine');
  const editorTitleEl       = $('#editor-title');
  const routineNameInput    = $('#routine-name');
  const exerciseListEditor  = $('#exercise-list-editor');
  const btnAddExercise      = $('#btn-add-exercise');

  // Player screen
  const btnPlayerBack       = $('#btn-player-back');
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
  // Audio – Web Audio API beeps (no external files)
  // ---------------------------------------------------------------------------

  let audioCtx = null;

  /** Lazy-init AudioContext (must be triggered by user gesture). */
  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (Safari requirement)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  /**
   * Play a short beep.
   * @param {number} freq  – Frequency in Hz (default 880)
   * @param {number} dur   – Duration in seconds (default 0.15)
   */
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
    } catch (_) {
      // Silently fail if audio is unavailable
    }
  }

  /** Play 3 short beeps to signal routine complete. */
  function beepComplete() {
    beep(880, 0.15);
    setTimeout(() => beep(880, 0.15), 250);
    setTimeout(() => beep(1200, 0.3), 500);
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
    // Seed with default routine if storage is empty
    if (routines.length === 0) {
      routines.push({ ...DEFAULT_ROUTINE });
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
      const totalSec = r.exercises.reduce((sum, e) => {
        return sum + (e.type === 'time' ? e.duration : 0) + (e.rest || 0);
      }, 0);
      const mins = Math.ceil(totalSec / 60);

      return `
        <div class="routine-card" data-id="${r.id}">
          <div class="routine-card-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="routine-card-info">
            <div class="routine-card-name">${escapeHtml(r.name)}</div>
            <div class="routine-card-meta">${exCount} exercise${exCount !== 1 ? 's' : ''} &middot; ~${mins} min</div>
          </div>
          <div class="routine-card-actions">
            <button class="btn btn-icon btn-edit-routine" data-id="${r.id}" aria-label="Edit routine">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-icon btn-delete-routine" data-id="${r.id}" aria-label="Delete routine">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');
  }

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------

  function openEditor(routineId) {
    if (routineId) {
      const r = routines.find((x) => x.id === routineId);
      if (!r) return;
      editingRoutineId = routineId;
      routineNameInput.value = r.name;
      editorExercises = JSON.parse(JSON.stringify(r.exercises));
      editorTitleEl.textContent = 'Edit Routine';
    } else {
      editingRoutineId = null;
      routineNameInput.value = '';
      editorExercises = [];
      editorTitleEl.textContent = 'New Routine';
    }
    renderEditorExercises();
    showScreen('editor');
  }

  function renderEditorExercises() {
    if (editorExercises.length === 0) {
      exerciseListEditor.innerHTML = `
        <div class="empty-state">
          <p>No exercises yet. Tap <strong>+ Add</strong> to get started.</p>
        </div>`;
      return;
    }

    exerciseListEditor.innerHTML = editorExercises.map((ex, idx) => {
      const detail = ex.type === 'time'
        ? `${ex.duration}s`
        : `${ex.reps} reps`;
      const restLabel = ex.rest > 0 ? ` + ${ex.rest}s rest` : '';

      return `
        <div class="exercise-row" data-idx="${idx}">
          <div class="exercise-row-info">
            <div class="exercise-row-name">${escapeHtml(ex.name)}</div>
            <div class="exercise-row-detail">${detail}${restLabel}</div>
          </div>
          <div class="exercise-row-actions">
            <button class="btn btn-icon btn-edit-exercise" data-idx="${idx}" aria-label="Edit exercise">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn btn-icon btn-delete-exercise" data-idx="${idx}" aria-label="Delete exercise">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </button>
            ${idx > 0 ? `<button class="btn btn-icon btn-move-up" data-idx="${idx}" aria-label="Move up">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>` : ''}
            ${idx < editorExercises.length - 1 ? `<button class="btn btn-icon btn-move-down" data-idx="${idx}" aria-label="Move down">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  function saveCurrentRoutine() {
    const name = routineNameInput.value.trim();
    if (!name) {
      routineNameInput.focus();
      return;
    }
    if (editorExercises.length === 0) {
      return;
    }

    if (editingRoutineId) {
      const r = routines.find((x) => x.id === editingRoutineId);
      if (r) {
        r.name = name;
        r.exercises = editorExercises;
      }
    } else {
      routines.push({
        id: generateId(),
        name,
        exercises: editorExercises,
      });
    }
    saveRoutines();
    renderRoutineList();
    showScreen('list');
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
      const ex = editorExercises[idx];
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
      editorExercises.push(ex);
    } else {
      editorExercises[editingExerciseIdx] = ex;
    }

    closeExerciseModal();
    renderEditorExercises();
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

    ensureAudioCtx(); // warm up audio on user gesture

    currentRoutine = JSON.parse(JSON.stringify(r));
    currentExIdx = 0;
    isRestPhase = false;
    isPlaying = true;
    routineStartTime = Date.now();

    playerRoutineName.textContent = currentRoutine.name;
    showScreen('player');
    loadCurrentStep();
    startTimer();
  }

  function loadCurrentStep() {
    const exercises = currentRoutine.exercises;
    const ex = exercises[currentExIdx];

    playerProgress.textContent = `${currentExIdx + 1} of ${exercises.length}`;

    // Clear rest phase class
    playerBody.classList.toggle('rest-phase', isRestPhase);

    if (isRestPhase) {
      // Rest between exercises
      playerExerciseName.textContent = 'REST';
      timerLabel.textContent = 'REST';
      timerTypeLabel.textContent = '';
      timeRemaining = ex.rest;
      totalTime = ex.rest;

      // Show next exercise preview
      const nextIdx = currentExIdx + 1;
      if (nextIdx < exercises.length) {
        playerNext.textContent = `Next: ${exercises[nextIdx].name}`;
      } else {
        playerNext.textContent = '';
      }

      // Hide reps button, show play/pause
      btnDoneReps.style.display = 'none';
      btnPlayPause.style.display = 'flex';
      updateTimerDisplay();
      setRingProgress(1);
    } else {
      // Active exercise
      playerExerciseName.textContent = ex.name;

      // Next exercise preview
      const hasRest = ex.rest > 0;
      const nextIdx = currentExIdx + (hasRest ? 0 : 1); // if rest, rest is next; else next exercise
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
        // Reps-based
        timerLabel.textContent = 'REPS';
        timerValue.textContent = ex.reps;
        timerTypeLabel.textContent = 'reps';
        timeRemaining = -1; // sentinel: no countdown
        totalTime = -1;
        setRingProgress(1);
        // Show "Done" button instead of play/pause
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
      // Time ran out – advance
      advanceStep();
      return;
    }
    if (totalTime > 0) {
      timeRemaining--;
      updateTimerDisplay();
      setRingProgress(timeRemaining / totalTime);

      // Beep on last 3 seconds
      if (timeRemaining <= 3 && timeRemaining > 0) {
        beep(660, 0.1);
      }

      if (timeRemaining <= 0) {
        beep(880, 0.2);
        advanceStep();
      }
    }
    // For reps, we just wait for the user to tap Done
  }

  function advanceStep() {
    const exercises = currentRoutine.exercises;
    const ex = exercises[currentExIdx];

    if (!isRestPhase && ex.rest > 0) {
      // Enter rest phase for this exercise
      isRestPhase = true;
      loadCurrentStep();
      return;
    }

    // Move to next exercise
    isRestPhase = false;
    currentExIdx++;

    if (currentExIdx >= exercises.length) {
      // Routine complete
      finishRoutine();
      return;
    }

    loadCurrentStep();
  }

  function finishRoutine() {
    stopTimer();
    isPlaying = false;
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
    if (isPlaying && !timerInterval) {
      startTimer();
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
    currentRoutine = null;
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

  /**
   * Set the circular progress ring.
   * @param {number} fraction – 0 (empty) to 1 (full)
   */
  function setRingProgress(fraction) {
    const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
    timerRingProgress.style.strokeDashoffset = offset;
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------------------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------------------------

  function bindEvents() {
    // --- List screen ---
    btnNewRoutine.addEventListener('click', () => openEditor(null));

    routineListEl.addEventListener('click', (e) => {
      // Edit button
      const editBtn = e.target.closest('.btn-edit-routine');
      if (editBtn) {
        e.stopPropagation();
        openEditor(editBtn.dataset.id);
        return;
      }
      // Delete button
      const delBtn = e.target.closest('.btn-delete-routine');
      if (delBtn) {
        e.stopPropagation();
        const id = delBtn.dataset.id;
        const r = routines.find((x) => x.id === id);
        showConfirm(`Delete "${r ? r.name : 'routine'}"?`, () => {
          routines = routines.filter((x) => x.id !== id);
          saveRoutines();
          renderRoutineList();
        });
        return;
      }
      // Card click – start routine
      const card = e.target.closest('.routine-card');
      if (card) {
        startRoutine(card.dataset.id);
      }
    });

    // --- Editor screen ---
    btnEditorBack.addEventListener('click', () => {
      showScreen('list');
    });

    btnSaveRoutine.addEventListener('click', saveCurrentRoutine);

    btnAddExercise.addEventListener('click', () => openExerciseModal(-1));

    exerciseListEditor.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit-exercise');
      if (editBtn) {
        openExerciseModal(parseInt(editBtn.dataset.idx, 10));
        return;
      }
      const delBtn = e.target.closest('.btn-delete-exercise');
      if (delBtn) {
        const idx = parseInt(delBtn.dataset.idx, 10);
        editorExercises.splice(idx, 1);
        renderEditorExercises();
        return;
      }
      const upBtn = e.target.closest('.btn-move-up');
      if (upBtn) {
        const idx = parseInt(upBtn.dataset.idx, 10);
        if (idx > 0) {
          [editorExercises[idx - 1], editorExercises[idx]] =
            [editorExercises[idx], editorExercises[idx - 1]];
          renderEditorExercises();
        }
        return;
      }
      const downBtn = e.target.closest('.btn-move-down');
      if (downBtn) {
        const idx = parseInt(downBtn.dataset.idx, 10);
        if (idx < editorExercises.length - 1) {
          [editorExercises[idx], editorExercises[idx + 1]] =
            [editorExercises[idx + 1], editorExercises[idx]];
          renderEditorExercises();
        }
        return;
      }
    });

    // --- Exercise modal ---
    exTypeTimeBtn.addEventListener('click', () => setExType('time'));
    exTypeRepsBtn.addEventListener('click', () => setExType('reps'));
    btnModalCancel.addEventListener('click', closeExerciseModal);
    btnModalSave.addEventListener('click', saveExerciseFromModal);

    // Close modal on overlay click
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
    btnPlayPause.addEventListener('click', togglePlayPause);
    btnSkip.addEventListener('click', skipStep);
    btnDoneReps.addEventListener('click', () => {
      beep(880, 0.15);
      advanceStep();
    });

    // --- Complete screen ---
    btnCompleteBack.addEventListener('click', () => {
      showScreen('list');
    });

    // --- Keyboard shortcuts ---
    document.addEventListener('keydown', (e) => {
      // Space to toggle play/pause in player
      if (screens.player.classList.contains('active')) {
        if (e.code === 'Space') {
          e.preventDefault();
          if (totalTime === -1) {
            // Reps mode – act as Done
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
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    loadRoutines();
    renderRoutineList();
    bindEvents();
    showScreen('list');
  }

  // Start the app when the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
