// Главная логика приложения: прогресс 24 недель, таймер, дневник и чертёж

const STORAGE_KEYS = {
  CURRENT_WEEK: 'masterkey_current_week',
  COMPLETED_WEEKS: 'masterkey_completed_weeks',
  WEEK_SESSIONS: 'masterkey_week_sessions', // сколько сессий пройдено на текущей неделе
  STREAK: 'masterkey_streak',
  LAST_PRACTICE_DATE: 'masterkey_last_practice_date',
  BLUEPRINT: 'masterkey_blueprint',
  JOURNAL: 'masterkey_journal'
};

class AppState {
  constructor() {
    this.currentWeek = parseInt(localStorage.getItem(STORAGE_KEYS.CURRENT_WEEK) || '1');
    this.completedWeeks = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPLETED_WEEKS) || '[]');
    this.weekSessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.WEEK_SESSIONS) || '{}');
    this.streak = parseInt(localStorage.getItem(STORAGE_KEYS.STREAK) || '0');
    this.lastPracticeDate = localStorage.getItem(STORAGE_KEYS.LAST_PRACTICE_DATE) || null;
    this.blueprint = JSON.parse(localStorage.getItem(STORAGE_KEYS.BLUEPRINT) || '{"goal":"","sensory":"","scene":""}');
    this.journal = JSON.parse(localStorage.getItem(STORAGE_KEYS.JOURNAL) || '[]');

    // Таймер
    this.timerDuration = 15 * 60; // 15 мин в секундах
    this.timerTimeLeft = this.timerDuration;
    this.timerInterval = null;
    this.isTimerRunning = false;
  }

  save() {
    localStorage.setItem(STORAGE_KEYS.CURRENT_WEEK, this.currentWeek);
    localStorage.setItem(STORAGE_KEYS.COMPLETED_WEEKS, JSON.stringify(this.completedWeeks));
    localStorage.setItem(STORAGE_KEYS.WEEK_SESSIONS, JSON.stringify(this.weekSessions));
    localStorage.setItem(STORAGE_KEYS.STREAK, this.streak);
    localStorage.setItem(STORAGE_KEYS.LAST_PRACTICE_DATE, this.lastPracticeDate || '');
    localStorage.setItem(STORAGE_KEYS.BLUEPRINT, JSON.stringify(this.blueprint));
    localStorage.setItem(STORAGE_KEYS.JOURNAL, JSON.stringify(this.journal));
  }

  getCurrentWeekData() {
    for (const stage of MASTER_KEY_STAGES) {
      const found = stage.weeks.find(w => w.number === this.currentWeek);
      if (found) return { stage, week: found };
    }
    return { stage: MASTER_KEY_STAGES[0], week: MASTER_KEY_STAGES[0].weeks[0] };
  }

  getWeekSessionsCount(weekNum) {
    return this.weekSessions[weekNum] || 0;
  }

  addSessionToCurrentWeek() {
    const w = this.currentWeek;
    this.weekSessions[w] = (this.weekSessions[w] || 0) + 1;

    // Обновляем стрик
    const today = new Date().toISOString().split('T')[0];
    if (this.lastPracticeDate !== today) {
      this.streak += 1;
      this.lastPracticeDate = today;
    }

    this.save();
  }

  completeWeek(weekNum) {
    if (!this.completedWeeks.includes(weekNum)) {
      this.completedWeeks.push(weekNum);
    }
    if (this.currentWeek === weekNum && this.currentWeek < 24) {
      this.currentWeek += 1;
    }
    this.save();
  }
}

const state = new AppState();

// Инициализация интерфейса
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  renderStagesTree();
  updateCurrentFocusCard();
  setupTimerUI();
  setupAudioUI();
  setupBlueprintUI();
  setupJournalUI();
  updateStreakUI();
});

// Переключение табов
function setupTabs() {
  const buttons = document.querySelectorAll('.bottom-nav .nav-item');
  const panes = document.querySelectorAll('.tab-pane');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      buttons.forEach(b => b.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');

      if (targetId === 'tab-practice') {
        syncPracticeView();
      }
    });
  });
}

function updateStreakUI() {
  const el = document.getElementById('streakCount');
  if (el) el.innerText = state.streak;
}

// Рендеринг дерева ступеней
function renderStagesTree() {
  const container = document.getElementById('stagesContainer');
  if (!container) return;
  container.innerHTML = '';

  MASTER_KEY_STAGES.forEach(stage => {
    const groupEl = document.createElement('div');
    groupEl.className = 'stage-group';

    const headerEl = document.createElement('div');
    headerEl.className = 'stage-group-header';
    headerEl.innerHTML = `
      <div class="stage-title-wrap">
        <h4>${stage.title}</h4>
        <span>${stage.weeksRange}</span>
      </div>
      <span class="chevron">▾</span>
    `;

    const weeksListEl = document.createElement('div');
    weeksListEl.className = 'weeks-list';

    stage.weeks.forEach(week => {
      const isCompleted = state.completedWeeks.includes(week.number);
      const isCurrent = state.currentWeek === week.number;
      const isLocked = week.number > state.currentWeek && !isCompleted;
      const sessions = state.getWeekSessionsCount(week.number);

      const weekEl = document.createElement('div');
      weekEl.className = `week-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'active' : ''} ${isLocked ? 'locked' : ''}`;
      
      let badgeContent = week.number;
      if (isCompleted) badgeContent = '✓';
      else if (isLocked) badgeContent = '🔒';

      weekEl.innerHTML = `
        <div class="week-left">
          <div class="week-num-badge">${badgeContent}</div>
          <div class="week-text">
            <h5>Неделя ${week.number}: ${week.title}</h5>
            <p>${week.focus} (${sessions}/${week.requiredSessions} сессий)</p>
          </div>
        </div>
      `;

      if (!isLocked) {
        weekEl.style.cursor = 'pointer';
        weekEl.addEventListener('click', () => {
          state.currentWeek = week.number;
          state.save();
          updateCurrentFocusCard();
          renderStagesTree();
          // Переключаем на таб практики
          document.querySelector('[data-tab="tab-practice"]').click();
        });
      }

      weeksListEl.appendChild(weekEl);
    });

    groupEl.appendChild(headerEl);
    groupEl.appendChild(weeksListEl);
    container.appendChild(groupEl);
  });
}

// Обновление карточки текущей ступени
function updateCurrentFocusCard() {
  const { stage, week } = state.getCurrentWeekData();
  const sessions = state.getWeekSessionsCount(week.number);
  const progressPercent = Math.min(100, Math.round((sessions / week.requiredSessions) * 100));

  document.getElementById('currentWeekTitle').innerText = `Неделя ${week.number}: ${week.title}`;
  document.getElementById('currentWeekGoal').innerText = `${week.focus}. Выполнено: ${sessions} из ${week.requiredSessions} рекомендуемых дней.`;
  document.getElementById('currentWeekProgress').style.width = `${progressPercent}%`;

  const btn = document.getElementById('startCurrentPracticeBtn');
  btn.onclick = () => {
    document.querySelector('[data-tab="tab-practice"]').click();
  };
}

// Синхронизация экрана практики
function syncPracticeView() {
  const { stage, week } = state.getCurrentWeekData();
  document.getElementById('practiceStageTag').innerText = `${stage.title} • Неделя ${week.number}`;
  document.getElementById('practiceWeekName').innerText = week.title;
  document.getElementById('practiceInstructionText').innerText = week.instruction;
}

// Таймер и логика сессии
function setupTimerUI() {
  const display = document.getElementById('timerDisplay');
  const toggleBtn = document.getElementById('toggleTimerBtn');
  const resetBtn = document.getElementById('resetTimerBtn');
  const durationBtn = document.getElementById('changeDurationBtn');

  function updateTimerText() {
    const mins = Math.floor(state.timerTimeLeft / 60);
    const secs = state.timerTimeLeft % 60;
    display.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  updateTimerText();

  toggleBtn.addEventListener('click', () => {
    if (state.isTimerRunning) {
      // Пауза
      clearInterval(state.timerInterval);
      state.isTimerRunning = false;
      toggleBtn.innerText = 'Продолжить';
      audioMgr.stop();
    } else {
      // Старт
      state.isTimerRunning = true;
      toggleBtn.innerText = 'Пауза';
      audioMgr.play();

      state.timerInterval = setInterval(() => {
        if (state.timerTimeLeft > 0) {
          state.timerTimeLeft--;
          updateTimerText();
        } else {
          // Завершение
          clearInterval(state.timerInterval);
          state.isTimerRunning = false;
          toggleBtn.innerText = 'Старт';
          audioMgr.stop();
          audioMgr.playBell();
          onSessionFinish();
        }
      }, 1000);
    }
  });

  // Выбор длительности через чипы
  const durationChips = document.querySelectorAll('.duration-chip');
  durationChips.forEach(chip => {
    chip.addEventListener('click', () => {
      if (state.isTimerRunning) return; // Не меняем на лету во время запущенной сессии
      durationChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const mins = parseInt(chip.getAttribute('data-mins'), 10);
      state.timerDuration = mins * 60;
      state.timerTimeLeft = state.timerDuration;
      updateTimerText();
    });
  });

  resetBtn.addEventListener('click', () => {
    clearInterval(state.timerInterval);
    state.isTimerRunning = false;
    state.timerTimeLeft = state.timerDuration;
    toggleBtn.innerText = 'Старт';
    audioMgr.stop();
    updateTimerText();
  });

  // Модалка завершения
  const modal = document.getElementById('finishModal');
  const modalYes = document.getElementById('modalConfirmYes');
  const modalNo = document.getElementById('modalConfirmNo');

  function onSessionFinish() {
    state.addSessionToCurrentWeek();
    updateStreakUI();
    updateCurrentFocusCard();
    renderStagesTree();

    const { week } = state.getCurrentWeekData();
    document.getElementById('modalQuestionText').innerText = week.checkQuestion;
    modal.classList.remove('hidden');
  }

  modalYes.addEventListener('click', () => {
    modal.classList.add('hidden');
    const { week } = state.getCurrentWeekData();
    const sessions = state.getWeekSessionsCount(week.number);
    if (sessions >= week.requiredSessions) {
      alert(`Поздравляем! Неделя ${week.number} полностью освоена! Открыта следующая ступень.`);
      state.completeWeek(week.number);
      renderStagesTree();
      updateCurrentFocusCard();
      syncPracticeView();
    } else {
      alert(`Отличная сессия! День ${sessions} из ${week.requiredSessions} зачтен.`);
    }
  });

  modalNo.addEventListener('click', () => {
    modal.classList.add('hidden');
    alert('Сессия сохранена в статистику. Практикуйте регулярно, не спешите: терпение — основа Системы Мастер-Ключ.');
  });
}

// Аудио интерфейс
function setupAudioUI() {
  const chips = document.querySelectorAll('.sound-chip');
  const trackName = document.getElementById('currentTrackName');
  const volSlider = document.getElementById('volumeSlider');
  const fileInput = document.getElementById('musicFileInput');
  const customIndicator = document.getElementById('customTrackIndicator');
  const customFileName = document.getElementById('customFileName');
  const removeCustomBtn = document.getElementById('removeCustomTrackBtn');
  const toggleCustomPlayBtn = document.getElementById('toggleCustomPlayBtn');
  const customSeek = document.getElementById('customTrackSeek');
  const customCurrentTime = document.getElementById('customCurrentTime');
  const customDuration = document.getElementById('customDuration');

  const titles = {
    alpha: 'Альфа 10 Гц (Фокус и ясность)',
    theta: 'Тета 6 Гц (Глубокое погружение)',
    rain: 'Розовый шум (Дождь)',
    silence: 'Полная тишина'
  };

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Переключение встроенных звуков
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const sound = chip.getAttribute('data-sound');
      
      // Сбрасываем UI кастомного плеера
      updatePlayBtnUI(false);

      audioMgr.setSoundMode(sound);
      trackName.innerText = titles[sound] || 'Звук';
    });
  });

  volSlider.addEventListener('input', (e) => {
    audioMgr.setVolume(e.target.value);
  });

  // Загрузка пользовательского файла
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      audioMgr.loadCustomFile(file);
      
      customFileName.innerText = file.name;
      customIndicator.classList.remove('hidden');
      trackName.innerText = `Свой трек: ${file.name.substring(0, 18)}...`;
      chips.forEach(c => c.classList.remove('active'));
      updatePlayBtnUI(false);
    }
  });

  // Кнопка предпрослушивания своего трека
  const playIcon = document.getElementById('playIcon');
  const playText = document.getElementById('playText');

  function updatePlayBtnUI(isPlaying) {
    if (isPlaying) {
      playIcon.innerText = '⏸';
      playText.innerText = 'Пауза';
    } else {
      playIcon.innerText = '▶';
      playText.innerText = 'Слушать трек';
    }
  }

  toggleCustomPlayBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Если мы слушали стандартный звук (альфа, тета и т.д.), снимаем с них фокус
    chips.forEach(c => c.classList.remove('active'));

    const isPlaying = audioMgr.toggleCustomPlay();
    updatePlayBtnUI(isPlaying);
    if (isPlaying) {
      trackName.innerText = `Свой трек: ${customFileName.innerText.substring(0, 18)}...`;
    }
  });

  // События аудио-элемента: обновление прогресса и времени
  const userEl = audioMgr.getAudioEl();
  if (userEl) {
    userEl.addEventListener('timeupdate', () => {
      const current = userEl.currentTime;
      const dur = userEl.duration;
      customCurrentTime.innerText = formatTime(current);
      if (!isNaN(dur) && dur > 0) {
        customSeek.value = (current / dur) * 100;
        customDuration.innerText = formatTime(dur);
      }
    });

    userEl.addEventListener('loadedmetadata', () => {
      customDuration.innerText = formatTime(userEl.duration);
    });

    userEl.addEventListener('play', () => {
      updatePlayBtnUI(true);
    });

    userEl.addEventListener('pause', () => {
      updatePlayBtnUI(false);
    });
  }

  // Перемотка трека
  customSeek.addEventListener('input', (e) => {
    const el = audioMgr.getAudioEl();
    if (el && !isNaN(el.duration) && el.duration > 0) {
      el.currentTime = (e.target.value / 100) * el.duration;
    }
  });

  // Удаление своего трека
  removeCustomBtn.addEventListener('click', () => {
    audioMgr.removeCustomFile();
    customIndicator.classList.add('hidden');
    fileInput.value = '';
    const alphaChip = document.querySelector('[data-sound="alpha"]');
    if (alphaChip) alphaChip.click();
  });
}

// Конструктор чертежа
function setupBlueprintUI() {
  const goalInput = document.getElementById('blueprintGoal');
  const sensoryInput = document.getElementById('blueprintSensory');
  const sceneInput = document.getElementById('blueprintScene');
  const saveBtn = document.getElementById('saveBlueprintBtn');
  const aiBtn = document.getElementById('aiAssistBtn');
  const reviewBox = document.getElementById('blueprintReviewOutput');
  const reviewContent = document.getElementById('blueprintReviewContent');

  // Загружаем сохраненный
  goalInput.value = state.blueprint.goal || '';
  sensoryInput.value = state.blueprint.sensory || '';
  sceneInput.value = state.blueprint.scene || '';

  saveBtn.addEventListener('click', () => {
    state.blueprint = {
      goal: goalInput.value,
      sensory: sensoryInput.value,
      scene: sceneInput.value
    };
    state.save();
    alert('Ментальный чертёж зафиксирован! По правилу Хаанела: удерживайте его неизменным, не переписывайте каждый день.');
  });

  // Экспертный анализ по принципам Хаанела
  aiBtn.addEventListener('click', () => {
    const goal = goalInput.value.trim();
    const sensory = sensoryInput.value.trim();
    const scene = sceneInput.value.trim();

    if (!goal) {
      alert('Заполните поле цели для проверки.');
      return;
    }

    const feedbacks = [];
    const lowerGoal = goal.toLowerCase();

    // Проверка 1: Отрицания и термины нехватки
    if (lowerGoal.includes('долг') || lowerGoal.includes('кредит') || lowerGoal.includes('болезн') || lowerGoal.includes('бедн') || lowerGoal.includes('не буду')) {
      feedbacks.push('⚠️ <strong>Ошибка фокуса на дефиците:</strong> Хаанел предостерегает: мысль притягивает то, о чем думаешь. Замените избавление от негатива (долги, болезни) на утверждение достатка и абсолютного здоровья.');
    }

    // Проверка 2: Будущее время
    if (lowerGoal.includes('буду') || lowerGoal.includes('хочу') || lowerGoal.includes('когда-нибудь') || lowerGoal.includes('мечтаю')) {
      feedbacks.push('⚠️ <strong>Ошибка времени:</strong> Подсознание воспринимает «хочу» как подтверждение нехватки прямо сейчас. Перепишите в настоящем времени: «Я руковожу...», «Я обладаю...».');
    } else {
      feedbacks.push('✅ <strong>Настоящее время:</strong> Отлично сформулировано как свершившийся факт.');
    }

    // Проверка 3: Сенсорика
    if (sensory.length < 20) {
      feedbacks.push('💡 <strong>Добавьте тактильности:</strong> Мысль заряжается кинестетикой. Опишите физический вес предмета, звук рукопожатия или уверенность в теле.');
    } else {
      feedbacks.push('✅ <strong>Сенсорная глубина:</strong> Образ наполнен живыми физическими якорями.');
    }

    // Проверка 4: Короткая сцена
    if (!scene) {
      feedbacks.push('💡 <strong>Сцена-якорь:</strong> Придумайте 10-секундный стоп-кадр или мини-сцену, которая будет для ума доказательством триумфа.');
    } else {
      feedbacks.push('✅ <strong>Ментальный экран:</strong> Сцена готова для медитаций 9–12 недель.');
    }

    reviewContent.innerHTML = feedbacks.map(f => `<p style="margin-bottom:8px;">${f}</p>`).join('');
    reviewBox.classList.remove('hidden');
  });
}

// Дневник наблюдений
function setupJournalUI() {
  const notesInput = document.getElementById('journalNotes');
  const scoreInput = document.getElementById('sessionScore');
  const saveBtn = document.getElementById('saveJournalBtn');
  const historyList = document.getElementById('journalHistoryList');

  function renderHistory() {
    historyList.innerHTML = '';
    if (state.journal.length === 0) {
      historyList.innerHTML = '<p style="font-size:12px; color:#94a3b8; text-align:center;">Пока нет записей. После каждой практики отмечайте состояние ума.</p>';
      return;
    }

    state.journal.slice().reverse().forEach(entry => {
      const card = document.createElement('div');
      card.className = 'journal-card';
      card.innerHTML = `
        <div class="journal-header">
          <span>Неделя ${entry.week} • ${entry.date}</span>
          <span style="color:var(--accent-gold); font-weight:700;">Фокус: ${entry.score}/10</span>
        </div>
        <div style="color:#f0f4f8;">${entry.text}</div>
      `;
      historyList.appendChild(card);
    });
  }

  renderHistory();

  saveBtn.addEventListener('click', () => {
    const text = notesInput.value.trim();
    if (!text) {
      alert('Напишите пару слов о вашем состоянии во время сессии.');
      return;
    }

    const newEntry = {
      id: Date.now(),
      week: state.currentWeek,
      date: new Date().toLocaleDateString('ru-RU'),
      score: scoreInput.value,
      text: text
    };

    state.journal.push(newEntry);
    state.save();
    notesInput.value = '';
    renderHistory();
    alert('Запись сохранена в личный дневник!');
  });
}
