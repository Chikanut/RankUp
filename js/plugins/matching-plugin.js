/**
 * MatchingPlugin - Режим "Встановлення Відповідності" з покроковою валідацією
 */

import BasePlugin from './base-plugin.js';

// Фіксований набір кольорів для ліній та фону
const MATCHING_COLORS = [
    '#3498db', // Blue
    '#2ecc71', // Green
    '#f1c40f', // Yellow
    '#e74c3c', // Red
    '#9b59b6', // Purple
    '#1abc9c', // Turquoise
    '#e67e22', // Orange
    '#34495e', // Dark Blue
    '#95a5a6', // Grey
];

export default class MatchingPlugin extends BasePlugin {
  
  static get metadata() {
    return {
      id: 'matching-stage', // Змінено ID для відображення покрокового режиму
      name: 'Встановлення Відповідності (Поетапно)',
      icon: '🔗',
      description: 'Зіставте питання з відповіддю, використовуючи кольорові лінії.'
    };
  }
  
  static supportsQuestion(question) {
    if (!question || !question.question || !Array.isArray(question.answers)) return false;
    return question.answers.some(a => a.isCorrect === true); 
  }
  
  constructor() {
    super();
    this.allSupportedQuestions = [];
    this.testQuestions = [];
    this.config = {};
    
    // Стани, пов'язані з етапами та помилками
    this.currentStageIndex = 0;
    this.stageQuestions = []; // Питання для поточного етапу
    this.stages = []; // Всі питання, розподілені по етапах
    this.globalMistakesCount = 0; // Загальна кількість помилок
    
    // Стан поточного завдання
    this.currentConnections = {}; // { questionId: answerId, ... } - відповіді користувача
    this.questionColorMap = {}; // { questionId: color, ... } - карта кольорів для малювання
    this.activeSelection = null; // ID активного вибраного елемента (питання)
    this.startTime = null;
    this.stageStartTime = null;
  }
  
  // ==================== SETUP (НАЛАШТУВАННЯ) ====================
  
  renderSetup(container, testData, questions) {
      this.allSupportedQuestions = questions;
      const allCategories = this.extractCategories(questions);
      const maxQuestions = questions.length;
      
      const categoryCheckboxes = allCategories.map(category => `
        <div class="checkbox-group">
          <input 
            type="checkbox" 
            id="cat-${category}" 
            value="${category}" 
            checked
            class="category-checkbox"
          />
          <label for="cat-${category}">${category}</label>
        </div>
      `).join('');

      container.innerHTML = `
        <div class="setup-container">
          <h2>⚙️ Налаштування Режиму Відповідності (Поетапно)</h2>
          <p class="muted">Тема: ${testData.meta.title}</p>
          <p class="muted" id="questionCountInfo">Доступно питань: ${maxQuestions}</p>
          
          <div class="setup-grid category-grid-enabled">
            
            <div class="setup-section categories-section">
                <h3>🗂️ Вибір Категорій</h3>
                <div class="category-list">
                  <div class="checkbox-group">
                    <input type="checkbox" id="selectAllCategories" checked />
                    <label for="selectAllCategories"><strong>Вибрати всі категорії</strong></label>
                  </div>
                  <div class="category-items">
                    ${categoryCheckboxes}
                  </div>
                </div>
            </div>

            <div class="setup-section options-section">
                <h3>Основні параметри</h3>
                
                <div class="input-group">
                  <label for="totalQuestions">🔢 Загальна кількість питань:</label>
                  <input type="number" id="totalQuestions" min="4" max="${maxQuestions}" value="${Math.min(20, maxQuestions)}" />
                  <span class="hint">Скільки всього питань буде використано.</span>
                </div>

                <div class="input-group">
                  <label for="pairsPerStage">🧮 Пар на етап:</label>
                  <input type="number" id="pairsPerStage" min="2" max="10" value="5" />
                  <span class="hint">Кількість пар для зіставлення в одному етапі.</span>
                </div>
                
                 <h3 class="mt-4">Опції режиму</h3>
                 <div class="checkbox-group">
                    <input type="checkbox" id="shuffleQuestions" checked />
                    <label for="shuffleQuestions">
                      <strong>🔀 Перемішати питання</strong>
                      <span class="hint">Випадковий порядок питань.</span>
                    </label>
                 </div>
            </div>
            
          </div>

          <div class="setup-actions">
            <button class="btn-primary btn-large" id="startMatchingTestBtn">
              🚀 Почати Тест
            </button>
            <button class="btn-ghost" id="backToModeBtn">
              ← Назад до вибору режиму
            </button>
          </div>
        </div>
      `;
      
      document.getElementById('startMatchingTestBtn').addEventListener('click', () => {
        this.startTest();
      });
      document.getElementById('backToModeBtn').addEventListener('click', () => {
        window.quizController.showModeSelection(); 
      });

      this.attachCategoryHandlers(allCategories);
  }
  
  getSetupConfig() {
    const selectedCategories = Array.from(document.querySelectorAll('.category-checkbox:checked'))
      .map(cb => cb.value);

    let totalQuestions = parseInt(document.getElementById('totalQuestions')?.value) || 20;
    totalQuestions = Math.max(1, Math.min(totalQuestions, this.allSupportedQuestions.length));

    let pairsPerStage = parseInt(document.getElementById('pairsPerStage')?.value) || 5;
    pairsPerStage = Math.max(2, Math.min(pairsPerStage, 10)); // Обмеження 2-10 пар

    return {
      totalQuestions,
      pairsPerStage,
      shuffleQuestions: document.getElementById('shuffleQuestions')?.checked ?? true,
      selectedCategories: selectedCategories,
    };
  }

  // ==================== QUIZ (ТЕСТУВАННЯ) ====================
  
  startTest() {
    this.config = this.getSetupConfig();
    
    let questions = this.allSupportedQuestions.filter(q => 
        this.config.selectedCategories.includes(q.category)
    );
    
    if (this.config.shuffleQuestions) {
      questions = this.shuffle(questions);
    }
    
    this.testQuestions = questions.slice(0, this.config.totalQuestions);
    
    if (this.testQuestions.length < this.config.pairsPerStage) {
       alert('Недостатньо питань для першого етапу. Зменште кількість пар на етап або оберіть більше питань/категорій.');
       return;
    }
    
    // Розподіл питань по етапах
    this.stages = this.chunkArray(this.testQuestions, this.config.pairsPerStage);

    // Ініціалізація стану
    this.currentStageIndex = 0;
    this.globalMistakesCount = 0;
    this.startTime = Date.now();
    
    window.quizController.showScreen('quiz');
    this.renderQuizInterface(document.getElementById('quiz'));
    
    this.loadStage(this.currentStageIndex);
  }

  /**
   * Завантажує дані для нового етапу
   */
  loadStage(index) {
    if (index >= this.stages.length) {
      this.finishTest();
      return;
    }
    
    this.currentStageIndex = index;
    this.stageQuestions = this.stages[index];
    this.stageStartTime = Date.now();

    this.currentConnections = {};
    this.activeSelection = null;
    this.questionColorMap = {};

    this.generateStageData();
    this.renderMatchingTask();
    this.updateProgressUI();
  }
  
  /**
   * Генерує дані для двох колонок, зберігаючи зв'язок (id).
   */
  generateStageData() {
    const pairingData = this.stageQuestions.map((q, i) => {
        const correctAnswers = q.answers.filter(a => a.isCorrect);
        const correctAnswerText = this.getRandomElement(correctAnswers).text;
        
        // Призначаємо рандомний колір, фіксуючи його в мапі
        const color = MATCHING_COLORS[i % MATCHING_COLORS.length];
        this.questionColorMap[q.id] = color;

        return {
            questionId: q.id, 
            questionText: q.question, 
            answerText: correctAnswerText,
            color
        };
    });

    // Створення незалежно перемішаних колонок
    this.columnA = this.shuffle(pairingData.map(p => ({ id: p.questionId, text: p.questionText, type: 'A', color: p.color })));
    this.columnB = this.shuffle(pairingData.map(p => ({ id: p.questionId, text: p.answerText, type: 'B' })));
  }

  renderQuizInterface(container) {
    this.clearContainer(container);
    
    container.innerHTML = `
      <div class="quiz-container matching-quiz-container">
        <div class="quiz-meta">
          <div class="meta-left">
            <span class="badge">🔗 Етап ${this.currentStageIndex + 1} / ${this.stages.length}</span>
          </div>
          <div class="meta-right">
            <span class="badge" id="progressText">0 / ${this.testQuestions.length} пройдено</span>
            <span class="badge badge-error" id="mistakesCounter">✗ Помилок: ${this.globalMistakesCount}</span>
            <span class="badge" id="timeCounter"></span>
          </div>
        </div>
        
        <div class="matching-task-area">
          <div class="matching-column" id="columnA">
              <h3>Питання</h3>
          </div>
          
          <svg class="connection-layer" id="connectionLayer"></svg>
          
          <div class="matching-column" id="columnB">
              <h3>Відповіді</h3>
          </div>
        </div>
        
        <div class="quiz-actions mt-5">
            <button class="btn-primary btn-large" id="checkStageBtn">
                ✅ Перевірити та перейти далі
            </button>
            <button class="btn-ghost" id="endEarlyBtn">Завершити тест</button>
        </div>
      </div>
    `;
    
    // Обробники
    document.getElementById('checkStageBtn').addEventListener('click', () => {
        this.checkStageAnswers();
    });
    document.getElementById('endEarlyBtn').addEventListener('click', () => {
      if (confirm('Ви впевнені, що хочете завершити тест?')) {
        this.finishTest();
      }
    });
    
    this.startTimer();
  }
  
  startTimer() {
    // Якщо таймер вже працює, не запускаємо
    if (this.timer) return; 

    // Реалізація "часу, що минув" (без ліміту)
    let seconds = 0;
    this.timer = setInterval(() => {
        seconds++;
        const totalSeconds = Math.round((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        
        document.getElementById('timeCounter').textContent = 
            `⏳ ${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000);
  }

  renderMatchingTask() {
    const colAEl = document.getElementById('columnA');
    const colBEl = document.getElementById('columnB');
    
    // Рендер Колонок:
    colAEl.innerHTML = `<h3>Питання</h3>` + this.columnA.map(item => `
        <button class="matching-item question-item" data-id="${item.id}" data-type="A" 
                style="--item-color: ${item.color};">
            ${item.text}
        </button>
    `).join('');
    
    colBEl.innerHTML = `<h3>Відповіді</h3>` + this.columnB.map(item => `
        <button class="matching-item answer-item" data-id="${item.id}" data-type="B">
            ${item.text}
        </button>
    `).join('');

    this.attachMatchingHandlers();
    
    // Важливо: для ініціалізації ліній (якщо ви використовуєте зовнішню бібліотеку)
    this.drawCurrentConnections(); 
  }
  
  attachMatchingHandlers() {
      document.querySelectorAll('.matching-item').forEach(item => {
          item.addEventListener('click', (e) => this.handleMatchClick(e.currentTarget));
      });
  }
  
  /**
   * Обробка кліку: логіка Click-to-Match для створення зв'язку (лінії)
   */
  handleMatchClick(element) {
      const id = element.dataset.id;
      const type = element.dataset.type;

      // Якщо елемент вже правильно зіставлений, ігноруємо (потрібно для наступного етапу)
      if (element.classList.contains('correct') || element.classList.contains('wrong')) return;

      if (type === 'A') { // Клік по питанню (Колонка А)
          
          // Якщо клікнули на активне питання, деактивуємо його
          if (this.activeSelection === id) {
              this.activeSelection = null;
              element.classList.remove('active-select');
          } else {
              // Деактивуємо попереднє активне питання, якщо воно є
              if (this.activeSelection) {
                  document.querySelector(`.question-item[data-id="${this.activeSelection}"]`).classList.remove('active-select');
              }
              // Активуємо нове питання
              this.activeSelection = id;
              element.classList.add('active-select');
          }
          
      } else if (type === 'B') { // Клік по відповіді (Колонка Б)
          
          if (!this.activeSelection) return; // Нічого не вибрано в Колонці А
          
          const qId = this.activeSelection;
          
          // Встановлення зв'язку
          this.currentConnections[qId] = id; 
          
          // Візуальне оновлення
          document.querySelector(`.question-item[data-id="${qId}"]`).classList.remove('active-select');
          this.activeSelection = null;
          
          this.drawCurrentConnections(); // Перемалювати всі лінії
      }
  }

  /**
   * Візуалізує поточні зв'язки користувача (лінії)
   * !!! Ця функція вимагає CSS та, ймовірно, SVG/Canvas
   */
  drawCurrentConnections() {
      const connectionLayer = document.getElementById('connectionLayer');
      if (!connectionLayer) return;

      // Очищаємо попередні лінії
      connectionLayer.innerHTML = '';
      
      // Скидаємо всі активні стилі для відповідей
      document.querySelectorAll('.answer-item').forEach(el => el.style.backgroundColor = '');

      for (const qId in this.currentConnections) {
          const aId = this.currentConnections[qId];
          const questionEl = document.querySelector(`.question-item[data-id="${qId}"]`);
          const answerEl = document.querySelector(`.answer-item[data-id="${aId}"]`);

          if (questionEl && answerEl) {
              const color = this.questionColorMap[qId];
              
              // 1. Колір фону відповіді
              answerEl.style.backgroundColor = color + '22'; // Додаємо прозорість до фону відповіді
              
              // 2. Клас для питання, що вже має зв'язок
              questionEl.classList.add('has-connection');

              // 3. Тут має бути логіка малювання лінії SVG/Canvas
              // Оскільки я не можу гарантувати SVG-реалізацію, ми обмежимося додаванням класів, 
              // які ви можете стилізувати:
              
              // ПРИКЛАД (припускає, що ви реалізуєте лінію за допомогою CSS::after або JS-SVG)
              
              const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
              // Налаштування лінії: колір, товщина
              line.setAttribute('stroke', color); 
              line.setAttribute('stroke-width', 2);
              
              // Обчислення координат
              const qRect = questionEl.getBoundingClientRect();
              const aRect = answerEl.getBoundingClientRect();
              const layerRect = connectionLayer.getBoundingClientRect();

              // Координати: початок лінії (центр правої сторони питання)
              const x1 = qRect.right - layerRect.left;
              const y1 = qRect.top + qRect.height / 2 - layerRect.top;

              // Координати: кінець лінії (центр лівої сторони відповіді)
              const x2 = aRect.left - layerRect.left;
              const y2 = aRect.top + aRect.height / 2 - layerRect.top;

              line.setAttribute('x1', x1);
              line.setAttribute('y1', y1);
              line.setAttribute('x2', x2);
              line.setAttribute('y2', y2);
              
              connectionLayer.appendChild(line);
          }
      }
  }

  /**
   * Обробляє натискання кнопки "Перевірити та перейти далі"
   */
  checkStageAnswers() {
      let stageCorrectCount = 0;
      let stageMistakes = 0;
      const totalPairs = this.stageQuestions.length;

      // Вимикаємо кнопку перевірки
      document.getElementById('checkStageBtn').disabled = true;
      
      // 1. Видаляємо всі попередні лінії (вони будуть замінені валідацією)
      document.getElementById('connectionLayer').innerHTML = '';
      
      // 2. Ітерація по всім можливим парам цього етапу
      this.stageQuestions.forEach(q => {
          const qId = q.id;
          const trueAnswer = this.getRandomElement(q.answers.filter(a => a.isCorrect));
          const trueAId = trueAnswer.id; // Припускаємо, що правильна відповідь має той самий ID, що і питання

          const userAnswerAId = this.currentConnections[qId];
          const questionEl = document.querySelector(`.question-item[data-id="${qId}"]`);
          const answerEl = document.querySelector(`.answer-item[data-id="${userAnswerAId}"]`);
          const color = this.questionColorMap[qId];
          
          questionEl.classList.remove('active-select', 'has-connection');
          
          // 3. Валідація
          const isCorrect = userAnswerAId && (qId === userAnswerAId); // Валідація по ID
          
          if (isCorrect) {
              stageCorrectCount++;
              questionEl.classList.add('correct');
              answerEl.classList.add('correct');
              this.drawResultLine(questionEl, answerEl, color, true); // Зелена лінія
          } else {
              stageMistakes++;
              this.globalMistakesCount++;
              
              // Червона лінія для неправильної спроби (якщо спроба була)
              if (answerEl) {
                  questionEl.classList.add('wrong');
                  answerEl.classList.add('wrong');
                  this.drawResultLine(questionEl, answerEl, color, false); // Червона лінія
              } else {
                  // Питання без відповіді
                  questionEl.classList.add('wrong');
                  // Показуємо правильну пару зеленим (щоб показати, що мало бути)
                  const correctElement = document.querySelector(`.answer-item[data-id="${qId}"]`);
                  if (correctElement) {
                     this.drawResultLine(questionEl, correctElement, '#2ecc71', true);
                  }
              }
          }
      });
      
      // Блокування всіх елементів
      document.querySelectorAll('.matching-item').forEach(el => el.disabled = true);
      
      // Оновлення UI
      this.updateMistakesUI();
      
      // Перехід до наступного етапу через 2 секунди
      setTimeout(() => {
          this.currentStageIndex++;
          this.loadStage(this.currentStageIndex);
      }, 2000);
  }
  
  /**
   * Малює фінальну лінію результату (зелену/червону)
   */
  drawResultLine(qEl, aEl, color, isCorrect) {
      const connectionLayer = document.getElementById('connectionLayer');
      if (!connectionLayer || !qEl || !aEl) return;
      
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      const finalColor = isCorrect ? '#2ecc71' : '#e74c3c';

      line.setAttribute('stroke', finalColor); 
      line.setAttribute('stroke-width', 3);
      
      // Обчислення координат
      const qRect = qEl.getBoundingClientRect();
      const aRect = aEl.getBoundingClientRect();
      const layerRect = connectionLayer.getBoundingClientRect();

      const x1 = qRect.right - layerRect.left;
      const y1 = qRect.top + qRect.height / 2 - layerRect.top;
      const x2 = aRect.left - layerRect.left;
      const y2 = aRect.top + aRect.height / 2 - layerRect.top;

      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      
      connectionLayer.appendChild(line);
      
      // Додатковий візуальний ефект
      aEl.style.backgroundColor = finalColor + '44'; 
      aEl.style.color = finalColor;
  }

  updateProgressUI() {
    const totalAnswered = this.currentStageIndex * this.config.pairsPerStage + 
                          (this.currentStageIndex > 0 ? this.stageQuestions.length : 0);
    const total = this.testQuestions.length;
    
    document.getElementById('progressText').textContent = 
        `${totalAnswered} / ${total} пройдено`;
  }
  
  updateMistakesUI() {
    document.getElementById('mistakesCounter').textContent = 
        `✗ Помилок: ${this.globalMistakesCount}`;
  }

  finishTest() {
    this.stopTimer(); 
    const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
    const totalPossiblePairs = this.testQuestions.length;
    
    // В даному режимі "правильна відповідь" - це успішно завершений етап
    const correctStageCount = this.currentStageIndex; 
    
    const results = {
      pluginId: this.constructor.metadata.id,
      totalQuestions: totalPossiblePairs, 
      answeredQuestions: totalPossiblePairs,
      correctCount: totalPossiblePairs - this.globalMistakesCount, // Успішно зіставлені пари
      mistakesCount: this.globalMistakesCount, 
      percentage: totalPossiblePairs > 0 
                  ? Math.round(((totalPossiblePairs - this.globalMistakesCount) / totalPossiblePairs) * 100) 
                  : 0,
      timeSpent,
      questions: this.testQuestions,
      userAnswers: { 
          stagesCompleted: this.currentStageIndex,
          totalMistakes: this.globalMistakesCount 
      }, 
      config: this.config,
      timestamp: Date.now(),
    };
    
    window.quizController.saveResults(results);
    window.quizController.showScreen('results');
    this.renderResults(document.getElementById('results'), results);
  }

  // ==================== HELPER МЕТОДИ ====================

  chunkArray(array, size) {
    const chunkedArr = [];
    for (let i = 0; i < array.length; i += size) {
        chunkedArr.push(array.slice(i, i + size));
    }
    return chunkedArr;
  }
  
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  getRandomElement(array) {
    if (!array || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
  }

  extractCategories(questions) {
    const categories = new Set();
    questions.forEach(q => {
      if (q.category) {
        categories.add(q.category);
      }
    });
    return Array.from(categories).sort();
  }
  
  attachCategoryHandlers(allCategories) {
    const selectAllCheckbox = document.getElementById('selectAllCategories');
    const categoryCheckboxes = document.querySelectorAll('.category-checkbox');
    
    const updateSelectAll = () => {
      const allChecked = Array.from(categoryCheckboxes).every(cb => cb.checked);
      selectAllCheckbox.checked = allChecked;
    };
    
    selectAllCheckbox.addEventListener('change', () => {
      categoryCheckboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
      });
    });
    
    categoryCheckboxes.forEach(cb => {
      cb.addEventListener('change', updateSelectAll);
    });
    
    updateSelectAll();
  }

  renderResults(container, results) {
    const isSuccess = results.percentage >= 70;

    container.innerHTML = `
      <div class="results-container">
        <div class="results-header ${isSuccess ? 'success' : 'fail'}">
          <div class="results-icon">🔗</div>
          <h1 class="results-percentage">${results.percentage}%</h1>
          <p class="results-status">${isSuccess ? 'Відмінний результат!' : 'Потрібно повторити'}</p>
        </div>
        
        <div class="results-stats">
          <div class="stat-card">
            <div class="stat-value">${results.correctCount} / ${results.totalQuestions}</div>
            <div class="stat-label">Правильно зіставлених пар</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-value">${results.mistakesCount}</div>
            <div class="stat-label">Неправильних спроб (сумарно)</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-value">${Math.floor(results.timeSpent / 60)}:${(results.timeSpent % 60).toString().padStart(2, '0')}</div>
            <div class="stat-label">Витрачено часу</div>
          </div>

          <div class="stat-card">
            <div class="stat-value">${results.userAnswers.stagesCompleted} / ${this.stages.length}</div>
            <div class="stat-label">Етапів пройдено</div>
          </div>
        </div>
        
        <div class="results-actions">
          <button class="btn-primary" id="retakeBtn">🔄 Пройти ще раз</button>
          <button class="btn-ghost" id="backToTestsBtn">← Назад до тестів</button>
        </div>
      </div>
    `;
    
    document.getElementById('retakeBtn').addEventListener('click', () => {
      window.quizController.showScreen('setup');
      this.renderSetup(
        document.getElementById('setup'),
        window.quizController.testData,
        this.constructor.filterQuestions(window.quizController.testData.questions)
      );
    });
    
    document.getElementById('backToTestsBtn').addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }
}