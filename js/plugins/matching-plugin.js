/**
 * matching-plugin.js
 * Повністю оновлена версія плагіна "Встановлення Відповідності" (повна рефакторинг + UI/UX)
 *
 * - Сумісна з BasePlugin / quizController (зберігаються точки входу: renderSetup, startTest, renderResults)
 * - Питання мають кольоровий фон, активний елемент підсвічується
 * - Дві чисті колонки, вирівнювання елементів по вертикалі
 * - SVG-шар для ліній, оновлюється при resize/scroll
 * - Перевірка здійснюється по реально правильному answer.id
 * - Кнопка "Перевірити" активна лише коли всі питання з'єднані
 */

import BasePlugin from './base-plugin.js';

const MATCHING_COLORS = [
  '#3498db', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#95a5a6'
];

export default class MatchingPlugin extends BasePlugin {
  static get metadata() {
    return {
      id: 'matching-stage-v2',
      name: 'Встановлення Відповідності (Оновлено)',
      icon: '🔗',
      description: 'Зіставте питання з відповіддю, використовуючи кольорові лінії. UI/UX оновлено.'
    };
  }

  static supportsQuestion(question) {
    if (!question || !question.question || !Array.isArray(question.answers)) return false;
    return question.answers.some(a => a.isCorrect === true);
  }

  constructor() {
    super();
    // data
    this.allSupportedQuestions = [];
    this.testQuestions = [];
    this.config = {};

    // stage logic
    this.currentStageIndex = 0;
    this.stages = [];
    this.stageQuestions = [];
    this.globalMistakesCount = 0;
    this.startTime = null;
    this.stageStartTime = null;

    // UI state for current stage
    this.currentConnections = {}; // qId -> answerId
    this.answerToQuestion = {}; // answerId -> qId (reverse map)
    this.questionColorMap = {}; // qId -> color
    this.activeSelection = null; // qId
    this.columnA = []; // questions (objects)
    this.columnB = []; // answers (objects)

    // internal timers / handlers
    this.timer = null;
    this.redrawHandler = null;

    // inject styles once
    this.ensureStyles();
  }

  // ==================== STYLES ====================
  ensureStyles() {
    if (document.getElementById('matching-plugin-v2-styles')) return;
    const css = `
      /* Matching plugin v2 styles */
      .matching-quiz-container { color: var(--text-color, #fff); font-family: Inter, Arial, sans-serif; }
      .matching-task-area { position: relative; display: flex; gap: 12px; align-items: flex-start; width: 100%; }
      .matching-column { flex: 1 1 45%; display: flex; flex-direction: column; gap: 12px; min-height: 280px;}
      .matching-column h3 { margin: 0 0 8px 0; font-size: 20px; color: #e6eef8; }
      .matching-item { border: none; border-radius: 12px; padding: 10px 14px; text-align: left; cursor: pointer; box-shadow: none; transition: transform .12s ease, box-shadow .12s ease; background: rgba(255,255,255,0.95); color: #0b1220; font-size: 15px; }
      .matching-item:disabled { opacity: 0.6; cursor: default; }
      .question-item { display: block; position: relative; }
      .answer-item { display: block; position: relative; }
      .matching-item:hover:not(:disabled) { transform: translateY(-2px); }
      .question-item.active-select { box-shadow: 0 6px 18px rgba(0,0,0,0.35); transform: scale(1.02); outline: 3px solid rgba(255,255,255,0.06); }
      .question-item.has-connection { opacity: 0.95; }
      .matching-column .empty-hint { opacity: 0.6; font-size: 14px; }
     .connection-layer {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
  background: transparent !important;   /* <— ось головне */
  mix-blend-mode: normal !important;    /* не дозволяє сіре змішування */
}
      .matching-meta { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:12px; }
      .badge { background: rgba(255,255,255,0.06); padding: 6px 10px; border-radius: 10px; color: #cfe7ff; }
      .badge-error { background: rgba(231,76,60,0.12); color: #ffb3b0; }
      .quiz-actions { display:flex; gap:12px; margin-top:18px; align-items:center; }
      .btn-primary[disabled] { opacity: 0.6; cursor:default; }
      .matching-item.correct { border: 2px solid #2ecc71; color: #2ecc71; background: rgba(46,204,113,0.08); }
      .matching-item.wrong { border: 2px solid #e74c3c; color: #e74c3c; background: rgba(231,76,60,0.06); }
      @media (max-width: 720px) {
        .matching-task-area { flex-direction: column;  isolation: isolate;}
        .matching-column { width: 100%; }
      }
    `;
    const style = document.createElement('style');
    style.id = 'matching-plugin-v2-styles';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

  // ==================== SETUP UI ====================
  renderSetup(container, testData, questions) {
    this.allSupportedQuestions = questions || [];
    const allCategories = this.extractCategories(this.allSupportedQuestions);
    const maxQuestions = this.allSupportedQuestions.length;

    const categoryCheckboxes = allCategories.map(cat => `
      <div class="checkbox-group" style="margin-bottom:6px;">
        <input type="checkbox" id="cat-${cat}" value="${cat}" class="category-checkbox" checked />
        <label for="cat-${cat}" style="margin-left:6px;">${cat}</label>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="setup-container">
        <h2>⚙️ Налаштування - Встановлення Відповідності</h2>
        <p class="muted">Тема: ${testData?.meta?.title ?? ''}</p>
        <div style="display:flex; gap:18px; margin-top:12px; flex-wrap:wrap;">
          <div style="flex:1 1 320px;">
            <h3>Категорії</h3>
            <div>
              <div><input type="checkbox" id="selectAllCategories" checked /> <label for="selectAllCategories"><strong>Вибрати всі</strong></label></div>
              <div style="margin-top:8px;">${categoryCheckboxes}</div>
            </div>
          </div>
          <div style="flex:1 1 260px;">
            <h3>Параметри</h3>
            <div style="margin-bottom:8px;">
              <label>🔢 Загальна кількість питань:</label><br/>
              <input type="number" id="totalQuestions" min="2" max="${maxQuestions}" value="${Math.min(20, maxQuestions)}" />
            </div>
            <div style="margin-bottom:8px;">
              <label>🧩 Пар на етап:</label><br/>
              <input type="number" id="pairsPerStage" min="1" max="10" value="4" />
            </div>
            <div style="margin-bottom:8px;">
              <input type="checkbox" id="shuffleQuestions" checked /> <label for="shuffleQuestions">🔀 Перемішати</label>
            </div>
          </div>
        </div>

        <div style="margin-top:16px;">
          <button class="btn-primary btn-large" id="startMatchingTestBtn">🚀 Почати тест</button>
          <button class="btn-ghost" id="backToModeBtn">← Назад</button>
        </div>
      </div>
    `;

    document.getElementById('startMatchingTestBtn').addEventListener('click', () => this.startTest());
    document.getElementById('backToModeBtn').addEventListener('click', () => window.quizController.showModeSelection());
    this.attachCategoryHandlers();
  }

  getSetupConfig() {
    const selectedCategories = Array.from(document.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value);
    let totalQuestions = parseInt(document.getElementById('totalQuestions')?.value) || 10;
    totalQuestions = Math.max(1, Math.min(totalQuestions, this.allSupportedQuestions.length));
    let pairsPerStage = parseInt(document.getElementById('pairsPerStage')?.value) || 4;
    pairsPerStage = Math.max(1, Math.min(pairsPerStage, 10));
    return {
      totalQuestions,
      pairsPerStage,
      shuffleQuestions: document.getElementById('shuffleQuestions')?.checked ?? true,
      selectedCategories
    };
  }

  attachCategoryHandlers() {
    const selectAll = document.getElementById('selectAllCategories');
    const boxes = document.querySelectorAll('.category-checkbox');
    if (!selectAll) return;
    const update = () => {
      const allChecked = Array.from(boxes).every(b => b.checked);
      selectAll.checked = allChecked;
    };
    selectAll.addEventListener('change', () => boxes.forEach(b => b.checked = selectAll.checked));
    boxes.forEach(b => b.addEventListener('change', update));
  }

  // ==================== START TEST ====================
  startTest() {
    this.config = this.getSetupConfig();

    let questions = (this.allSupportedQuestions || []).filter(q => this.config.selectedCategories.includes(q.category));
    if (this.config.shuffleQuestions) questions = this.shuffle(questions);

    this.testQuestions = questions.slice(0, this.config.totalQuestions);
    if (this.testQuestions.length < 1) { alert('Нема питань для тесту.'); return; }

    this.stages = this.chunkArray(this.testQuestions, this.config.pairsPerStage);
    this.currentStageIndex = 0;
    this.globalMistakesCount = 0;
    this.startTime = Date.now();

    window.quizController.showScreen('quiz');
    const quizContainer = document.getElementById('quiz');
    this.renderQuizInterface(quizContainer);

    this.loadStage(this.currentStageIndex);
  }

  // ==================== RENDER QUIZ UI ====================
  renderQuizInterface(container) {
    this.clearContainer(container);

    container.innerHTML = `
      <div class="quiz-container matching-quiz-container">
        <div class="matching-meta">
          <div>
            <span class="badge">🔗 Етап <span id="stageBadge">0</span> / ${this.stages.length}</span>
          </div>
          <div style="display:flex; gap:10px; align-items:center;">
            <span class="badge" id="progressText">0 / ${this.testQuestions.length} пройдено</span>
            <span class="badge badge-error" id="mistakesCounter">✗ Помилок: ${this.globalMistakesCount}</span>
            <span class="badge" id="timeCounter">⏳ 0:00</span>
          </div>
        </div>

        <div class="matching-task-area" id="matchingTaskArea" style="min-height:340px;">
          <div class="matching-column" id="columnA"><h3>Питання</h3></div>
          <svg class="connection-layer" id="connectionLayer" xmlns="http://www.w3.org/2000/svg"></svg>
          <div class="matching-column" id="columnB"><h3>Відповіді</h3></div>
        </div>

        <div class="quiz-actions">
          <button class="btn-primary" id="checkStageBtn" disabled>✅ Перевірити та перейти далі</button>
          <button class="btn-ghost" id="endEarlyBtn">Завершити тест</button>
        </div>
      </div>
    `;

    document.getElementById('checkStageBtn').addEventListener('click', () => this.checkStageAnswers());
    document.getElementById('endEarlyBtn').addEventListener('click', () => {
      if (confirm('Завершити тест?')) this.finishTest();
    });

    this.startTimer();

    // redraw on resize/scroll
    this.redrawHandler = () => this.drawCurrentConnections();
    window.addEventListener('resize', this.redrawHandler);
    window.addEventListener('scroll', this.redrawHandler, true);
  }

  // ==================== STAGE DATA ====================
  loadStage(index) {
    if (index >= this.stages.length) { this.finishTest(); return; }

    this.currentStageIndex = index;
    this.stageQuestions = this.stages[index] || [];
    this.stageStartTime = Date.now();

    // reset stage state
    this.currentConnections = {};
    this.answerToQuestion = {};
    this.questionColorMap = {};
    this.activeSelection = null;
    this.columnA = [];
    this.columnB = [];

    this.generateStageData();
    this.renderMatchingTask();
    this.updateProgressUI();
    document.getElementById('stageBadge').textContent = `${this.currentStageIndex + 1}`;
  }

  generateStageData() {
  const pairingData = this.stageQuestions.map((q, i) => {
    const correct = q.answers.find(a => a.isCorrect) || q.answers[0];
    const color = MATCHING_COLORS[i % MATCHING_COLORS.length];
    this.questionColorMap[q.id] = color;

    // створюємо унікальний id для пари питання-відповіді
    const generatedAnswerId = `ans_${q.id}`;

    return {
      qId: q.id,
      qText: q.question,
      answerId: generatedAnswerId,
      answerText: correct.text,
      qRaw: q
    };
  });

  // тепер кожне питання має свій унікальний answerId
  this.columnA = this.shuffle(
    pairingData.map(p => ({
      id: p.qId,
      text: p.qText,
      color: this.questionColorMap[p.qId]
    }))
  );

  this.columnB = this.shuffle(
    pairingData.map(p => ({
      id: p.answerId, // унікальний ID, не дублюється
      text: p.answerText,
      linkTo: p.qId // зберігаємо зв’язок для перевірки
    }))
  );

  // створюємо мапу правильних відповідей для перевірки
  this.correctAnswerMap = {};
  pairingData.forEach(p => (this.correctAnswerMap[p.qId] = p.answerId));
}


  // ==================== RENDER TASK ====================
  renderMatchingTask() {
    const colAEl = document.getElementById('columnA');
    const colBEl = document.getElementById('columnB');
    const layer = document.getElementById('connectionLayer');

    // make connection layer fill the parent
    const taskArea = document.getElementById('matchingTaskArea');
    layer.setAttribute('width', '100%');
    layer.setAttribute('height', '100%');
    layer.innerHTML = '';

    // build question items
    colAEl.innerHTML = `<h3>Питання</h3>` + this.columnA.map(item => `
      <button class="matching-item question-item" data-qid="${item.id}" style="--item-color:${item.color}; background:${this.rgba(item.color,1)}; border-left:6px solid ${item.color};">
        ${this.escapeHtml(item.text)}
      </button>
    `).join('');

    // build answer items
    colBEl.innerHTML = `<h3>Відповіді</h3>` + this.columnB.map(item => `
      <button class="matching-item answer-item" data-aid="${item.id}">
        ${this.escapeHtml(item.text)}
      </button>
    `).join('');

    // ensure equal spacing: add invisible spacers if counts differ
    this.equalizeColumnHeights();

    this.attachMatchingHandlers();
    this.drawCurrentConnections();
    this.updateCheckButtonState();
  }

  // ensure both columns have similar vertical distribution by adding placeholders
  equalizeColumnHeights() {
    const colAEl = document.getElementById('columnA');
    const colBEl = document.getElementById('columnB');
    const qCount = this.columnA.length;
    const aCount = this.columnB.length;
    // Remove previous spacers if any
    colAEl.querySelectorAll('.spacer').forEach(s => s.remove());
    colBEl.querySelectorAll('.spacer').forEach(s => s.remove());
    const max = Math.max(qCount, aCount);
    // For flexibility, do nothing (we rely on flex gap for layout) but ensure min-height already used
  }

  attachMatchingHandlers() {
    // questions
    document.querySelectorAll('.question-item').forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('active-select','has-connection','correct','wrong');
      btn.addEventListener('click', (e) => {
        const qid = e.currentTarget.dataset.qid;
        this.handleQuestionClick(qid);
      });
    });

    // answers
    document.querySelectorAll('.answer-item').forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('correct','wrong');
      btn.style.backgroundColor = ''; btn.style.color = '';
      btn.addEventListener('click', (e) => {
        const aid = e.currentTarget.dataset.aid;
        this.handleAnswerClick(aid);
      });
    });
  }

  handleQuestionClick(qid) {
    // toggle active selection
    if (this.activeSelection === qid) {
      // deactivate
      this.activeSelection = null;
      const el = document.querySelector(`.question-item[data-qid="${qid}"]`);
      if (el) el.classList.remove('active-select');
    } else {
      // deactivate previous
      if (this.activeSelection) {
        const prev = document.querySelector(`.question-item[data-qid="${this.activeSelection}"]`);
        if (prev) prev.classList.remove('active-select');
      }
      this.activeSelection = qid;
      const el = document.querySelector(`.question-item[data-qid="${qid}"]`);
      if (el) el.classList.add('active-select');
    }
  }

  handleAnswerClick(aid) {
    if (!this.activeSelection) return; // nothing selected
    const qid = this.activeSelection;

    // If this answer already used by another question, remove that mapping
    if (this.answerToQuestion[aid] && this.answerToQuestion[aid] !== qid) {
      const prevQ = this.answerToQuestion[aid];
      delete this.currentConnections[prevQ];
      delete this.answerToQuestion[aid];
      const prevQEl = document.querySelector(`.question-item[data-qid="${prevQ}"]`);
      if (prevQEl) prevQEl.classList.remove('has-connection');
    }

    // If this question previously had another answer, clear reverse mapping
    const prevAnswerForQ = this.currentConnections[qid];
    if (prevAnswerForQ && prevAnswerForQ !== aid) {
      delete this.answerToQuestion[prevAnswerForQ];
    }

    // create mapping
    this.currentConnections[qid] = aid;
    this.answerToQuestion[aid] = qid;

    // apply per-element UI
    const qEl = document.querySelector(`.question-item[data-qid="${qid}"]`);
    const aEl = document.querySelector(`.answer-item[data-aid="${aid}"]`);
    if (qEl) { qEl.classList.add('has-connection'); qEl.classList.remove('active-select'); }
    if (aEl) {
      const color = this.questionColorMap[qid] || '#3498db';
      aEl.style.backgroundColor = this.rgba(color, 1.0);
      aEl.style.borderLeft = `6px solid ${color}`;
    }

    this.activeSelection = null;
    this.drawCurrentConnections();
    this.updateCheckButtonState();
  }

  // enable check button only when all questions have a mapping
  updateCheckButtonState() {
    const required = this.columnA.length;
    const have = Object.keys(this.currentConnections).length;
    const btn = document.getElementById('checkStageBtn');
    if (!btn) return;
    btn.disabled = have < required;
  }

  // ==================== DRAWING LINES ====================
  // draw current (temporary) connections
  drawCurrentConnections() {
    const layer = document.getElementById('connectionLayer');
    const taskArea = document.getElementById('matchingTaskArea');
    if (!layer || !taskArea) return;
    // set size to parent
    const rect = taskArea.getBoundingClientRect();
    layer.setAttribute('width', rect.width);
    layer.setAttribute('height', rect.height);
    layer.style.width = rect.width + 'px';
    layer.style.height = rect.height + 'px';
    layer.innerHTML = '';

    // For each current connection draw a line
    for (const qId in this.currentConnections) {
      const aId = this.currentConnections[qId];
      const qEl = document.querySelector(`.question-item[data-qid="${qId}"]`);
      const aEl = document.querySelector(`.answer-item[data-aid="${aId}"]`);
      if (!qEl || !aEl) continue;

      const color = this.questionColorMap[qId] || '#3498db';
      // compute coordinates relative to layer
      const qRect = qEl.getBoundingClientRect();
      const aRect = aEl.getBoundingClientRect();
      const layerRect = layer.getBoundingClientRect();
      // x1 = right center of question, x2 = left center of answer
      const x1 = (qRect.right - layerRect.left);
      const y1 = (qRect.top + qRect.height / 2 - layerRect.top);
      const x2 = (aRect.left - layerRect.left);
      const y2 = (aRect.top + aRect.height / 2 - layerRect.top);

      // create bezier path for nicer visuals
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const midX = (x1 + x2) / 2;
      const d = `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`;
      path.setAttribute('d', d);
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', 3);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap','round');
      path.setAttribute('stroke-opacity','0.9');
      layer.appendChild(path);
    }
  }

  // draw a single result line with final color (green/red)
  drawResultLine(qEl, aEl, colorHex, isCorrect) {
    const layer = document.getElementById('connectionLayer');
    if (!layer || !qEl || !aEl) return;

    const qRect = qEl.getBoundingClientRect();
    const aRect = aEl.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const x1 = (qRect.right - layerRect.left);
    const y1 = (qRect.top + qRect.height / 2 - layerRect.top);
    const x2 = (aRect.left - layerRect.left);
    const y2 = (aRect.top + aRect.height / 2 - layerRect.top);

    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    const midX = (x1 + x2) / 2;
    const d = `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`;
    path.setAttribute('d', d);
    path.setAttribute('stroke', isCorrect ? '#2ecc71' : '#e74c3c');
    path.setAttribute('stroke-width', isCorrect ? 4 : 4);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap','round');
    layer.appendChild(path);

    // style answer element for clear result
    if (aEl) {
      aEl.style.backgroundColor = (isCorrect ? this.rgba('#2ecc71',0.18) : this.rgba('#e74c3c',0.18));
      aEl.style.color = isCorrect ? '#2ecc71' : '#e74c3c';
    }
  }

  // ==================== CHECK / VALIDATION ====================
  checkStageAnswers() {
    const totalPairs = this.stageQuestions.length;
    const btn = document.getElementById('checkStageBtn');
    if (btn) btn.disabled = true;

    const layer = document.getElementById('connectionLayer');
    if (layer) layer.innerHTML = '';

    let stageMistakes = 0;
    let stageCorrect = 0;

    // validate each question in stageQuestions (original objects)
    this.stageQuestions.forEach(q => {
      const qId = q.id;
      const correctAId = this.correctAnswerMap[q.id];
      const userAId = this.currentConnections[qId];

      const qEl = document.querySelector(`.question-item[data-qid="${qId}"]`);
      const userAnswerEl = userAId ? document.querySelector(`.answer-item[data-aid="${userAId}"]`) : null;
      const correctAnswerEl = document.querySelector(`.answer-item[data-aid="${correctAId}"]`);

      const isCorrect = userAId === correctAId;

      if (isCorrect) {
        stageCorrect++;
        if (qEl) qEl.classList.add('correct');
        if (userAnswerEl) userAnswerEl.classList.add('correct');
        this.drawResultLine(qEl, userAnswerEl, this.questionColorMap[qId], true);
      } else {
        stageMistakes++;
        this.globalMistakesCount++;
        if (qEl) qEl.classList.add('wrong');

        if (userAnswerEl) {
          userAnswerEl.classList.add('wrong');
          this.drawResultLine(qEl, userAnswerEl, this.questionColorMap[qId], false);
        }
        // also show correct mapping in green if available
        if (correctAnswerEl) {
          this.drawResultLine(qEl, correctAnswerEl, '#2ecc71', true);
        }
      }
    });

    // disable all items
    document.querySelectorAll('.matching-item').forEach(el => el.disabled = true);

    // update UI
    this.updateMistakesUI();

    // after short pause move to next stage
    setTimeout(() => {
      this.currentStageIndex++;
      this.loadStage(this.currentStageIndex);
    }, 1500);
  }

  // ==================== PROGRESS / TIMER / RESULTS ====================
  updateProgressUI() {
    const totalAnswered = (this.currentStageIndex) * (this.config.pairsPerStage || 0);
    const total = this.testQuestions.length;
    const progressText = document.getElementById('progressText');
    if (progressText) progressText.textContent = `${Math.min(totalAnswered, total)} / ${total} пройдено`;
  }

  updateMistakesUI() {
    const el = document.getElementById('mistakesCounter');
    if (el) el.textContent = `✗ Помилок: ${this.globalMistakesCount}`;
  }

  startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const totalSeconds = Math.round((Date.now() - this.startTime) / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      const el = document.getElementById('timeCounter');
      if (el) el.textContent = `⏳ ${minutes}:${seconds.toString().padStart(2,'0')}`;
    }, 1000);
  }

  stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    window.removeEventListener('resize', this.redrawHandler);
    window.removeEventListener('scroll', this.redrawHandler, true);
  }

  finishTest() {
    this.stopTimer();
    const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
    const totalPossiblePairs = this.testQuestions.length;

    const results = {
      pluginId: this.constructor.metadata.id,
      totalQuestions: totalPossiblePairs,
      answeredQuestions: totalPossiblePairs,
      correctCount: Math.max(0, totalPossiblePairs - this.globalMistakesCount),
      mistakesCount: this.globalMistakesCount,
      percentage: totalPossiblePairs > 0 ? Math.round(((totalPossiblePairs - this.globalMistakesCount) / totalPossiblePairs) * 100) : 0,
      timeSpent,
      questions: this.testQuestions,
      userAnswers: {
        stagesCompleted: this.currentStageIndex,
        totalMistakes: this.globalMistakesCount
      },
      config: this.config,
      timestamp: Date.now()
    };

    window.quizController.saveResults(results);
    window.quizController.showScreen('results');
    this.renderResults(document.getElementById('results'), results);
  }

  renderResults(container, results) {
    const isSuccess = results.percentage >= 70;
    container.innerHTML = `
      <div class="results-container">
        <div class="results-header ${isSuccess ? 'success' : 'fail'}" style="margin-bottom:12px;">
          <div class="results-icon">🔗</div>
          <h1 class="results-percentage">${results.percentage}%</h1>
          <p class="results-status">${isSuccess ? 'Відмінний результат!' : 'Потрібно повторити'}</p>
        </div>

        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <div style="flex:1 1 160px;">
            <div class="stat-value">${results.correctCount} / ${results.totalQuestions}</div>
            <div class="stat-label">Правильно зіставлених пар</div>
          </div>
          <div style="flex:1 1 120px;">
            <div class="stat-value">${results.mistakesCount}</div>
            <div class="stat-label">Неправильних спроб</div>
          </div>
          <div style="flex:1 1 160px;">
            <div class="stat-value">${Math.floor(results.timeSpent / 60)}:${(results.timeSpent % 60).toString().padStart(2,'0')}</div>
            <div class="stat-label">Витрачено часу</div>
          </div>
        </div>

        <div style="margin-top:12px;">
          <button class="btn-primary" id="retakeBtn">🔄 Пройти ще раз</button>
          <button class="btn-ghost" id="backToTestsBtn">← Назад</button>
        </div>
      </div>
    `;

    document.getElementById('retakeBtn').addEventListener('click', () => {
      window.quizController.showScreen('setup');
      this.renderSetup(document.getElementById('setup'), window.quizController.testData,
        this.constructor.filterQuestions(window.quizController.testData.questions));
    });
    document.getElementById('backToTestsBtn').addEventListener('click', () => { window.location.href = 'index.html'; });
  }

  // ==================== HELPERS ====================
  chunkArray(array, size) {
    const res = [];
    for (let i = 0; i < array.length; i += size) res.push(array.slice(i, i + size));
    return res;
  }

  shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  rgba(hex, alpha = 0.12) {
    // hex -> rgba
    const h = hex.replace('#','');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  extractCategories(questions) {
    const s = new Set();
    (questions || []).forEach(q => { if (q.category) s.add(q.category); });
    return Array.from(s).sort();
  }

  clearContainer(container) {
    if (!container) return;
    container.innerHTML = '';
  }

  // ==================== Cleanup on unload (optional) ====================
  // call when plugin is destroyed by host (not implemented in base)
  destroy() {
    this.stopTimer();
    window.removeEventListener('resize', this.redrawHandler);
    window.removeEventListener('scroll', this.redrawHandler, true);
  }
}
