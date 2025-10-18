/**
 * Flashcard Plugin
 * * Режим навчання через флешкартки з активним згадуванням.
 * Користувач бачить питання, намагається згадати відповідь,
 * потім перевіряє себе та чесно оцінює чи знав відповідь.
 */

import BasePlugin from './base-plugin.js';

export default class FlashcardPlugin extends BasePlugin {
  
  // ==================== МЕТАДАНІ (ВІДПОВІДАЄ BASE-PLUGIN) ====================
  
  static get metadata() {
    return {
      id: 'flashcard',
      name: 'Флешкартки (Перевірка)',
      icon: '📇',
      description: 'Активне згадування з лімітом помилок та часу'
    };
  }

  // ==================== ВАЛІДАЦІЯ (ВІДПОВІДАЄ BASE-PLUGIN) ====================
  
  /**
   * Валідація окремого питання
   * @param {Object} question - одне питання
   * @returns {boolean} true якщо плагін може працювати з цим питанням
   */
  static supportsQuestion(question) {
    if (!question || typeof question !== 'object') return false;
    if (!question.question || typeof question.question !== 'string') return false;
    
    if (!Array.isArray(question.answers) || question.answers.length === 0) return false;
    
    // Повинна бути хоча б одна правильна відповідь
    const hasCorrect = question.answers.some(a => a.isCorrect === true);
    return hasCorrect;
  }
  
  /**
   * Допоміжний метод для фільтрації питань за категоріями.
   * Успадковуємо логіку від BasePlugin.
   * @param {Array} questions - масив питань
   * @returns {Array} відфільтрований масив
   */
  static filterQuestions(questions) {
    // В FlashcardPlugin ми можемо просто повернути всі підтримувані питання
    return questions.filter(q => this.supportsQuestion(q));
  }
  
  // ==================== КОНСТРУКТОР ТА СТАН ====================
  
  constructor() {
    super();
    this.currentQuestion = null;
    this.isRevealed = false;
    this.currentAnswer = null;
    this.questionsToReview = []; 
    this.knownQuestionsIds = new Set();
    this.allSupportedQuestions = []; // Усі питання, які підтримує плагін
    this.testQuestions = []; // Відфільтровані та вибрані питання
    this.currentQuestionIndex = 0;
    this.userResults = [];
    this.startTime = null;
    this.timeLimitTimer = null;
    this.remainingTime = 0;
    this.mistakesCount = 0;
  }
  
  // ==================== SETUP (НАЛАШТУВАННЯ) ====================
  
  /**
   * Рендер інтерфейсу налаштувань тесту
   * @param {HTMLElement} container - контейнер для рендерингу
   * @param {Object} testData - дані тесту
   * @param {Array} questions - відфільтровані питання (усі підтримувані)
   */
  renderSetup(container, testData, questions) {
    this.allSupportedQuestions = questions;
    const allCategories = this.extractCategories(questions);
    const maxQuestions = questions.length;
    
    const defaultSettings = {
      repeatUnknown: true,
      shuffleQuestions: true,
      questionCount: Math.min(20, maxQuestions),
      maxMistakes: 5,
      timeLimitMinutes: 0,
      selectedCategories: allCategories, // Усі категорії за замовчуванням
    };
    
    // Якщо є попередні налаштування, їх можна завантажити
    const settings = defaultSettings; 
    
    const maxSelectable = maxQuestions > 0 ? maxQuestions : 1;

    // Генерація HTML для вибору категорій
    const categoryCheckboxes = allCategories.map(category => `
      <div class="checkbox-group">
        <input 
          type="checkbox" 
          id="cat-${category}" 
          value="${category}" 
          ${settings.selectedCategories.includes(category) ? 'checked' : ''} 
          class="category-checkbox"
        />
        <label for="cat-${category}">${category}</label>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="setup-container">
        <h2>⚙️ Налаштування Режиму Флешкарток</h2>
        <p class="muted">Тема: ${testData.meta.title}</p>
        <p class="muted">Доступно карток: ${maxQuestions}</p>
        
        <div class="setup-grid category-grid-enabled">
          
          <div class="setup-section categories-section">
            <h3>🗂️ Вибір Категорій</h3>
            <p class="hint">Оберіть, з яких категорій брати питання.</p>
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
            <h3>Ліміти та Критерії</h3>
            
            <div class="input-group">
              <label for="questionCount">🔢 Кількість карток:</label>
              <input type="number" id="questionCount" min="1" max="${maxSelectable}" value="${Math.min(settings.questionCount, maxSelectable)}" />
              <span class="hint">Виберіть кількість питань для проходження. (Макс. ${maxQuestions})</span>
            </div>

            <div class="input-group">
              <label for="maxMistakes">❌ Макс. помилок:</label>
              <input type="number" id="maxMistakes" min="0" value="${settings.maxMistakes}" />
              <span class="hint">Максимальна кількість карток, які можна "не знати". 0 = без ліміту.</span>
            </div>
            
            <div class="input-group">
              <label for="timeLimitMinutes">⏳ Ліміт часу (хв):</label>
              <input type="number" id="timeLimitMinutes" min="0" value="${settings.timeLimitMinutes}" />
              <span class="hint">Час, відведений на проходження. 0 = без ліміту.</span>
            </div>
            
            <h3 class="mt-4">Опції режиму</h3>
            <div class="checkbox-group">
              <input type="checkbox" id="repeatUnknown" ${settings.repeatUnknown ? 'checked' : ''} />
              <label for="repeatUnknown">
                <strong>🔄 Повторювати невідомі картки</strong>
                <span class="hint">Картки, які ви позначили як "Не знав", повертаються в чергу.</span>
              </label>
            </div>
            
            <div class="checkbox-group">
              <input type="checkbox" id="shuffleQuestions" ${settings.shuffleQuestions ? 'checked' : ''} />
              <label for="shuffleQuestions">
                <strong>🔀 Перемішати картки</strong>
                <span class="hint">Випадковий порядок карток.</span>
              </label>
            </div>

            <p class="muted mt-3">✨ Анімація перевороту та коментарі до відповідей завжди увімкнені.</p>
          </div>
        </div>

        <div class="setup-actions">
          <button class="btn-primary btn-large" id="startFlashcardTestBtn">
            🚀 Почати навчання
          </button>
          <button class="btn-ghost" id="backToModeBtn">
            ← Назад до вибору режиму
          </button>
        </div>
      </div>
    `;
    
    // Обробники
    document.getElementById('startFlashcardTestBtn').addEventListener('click', () => {
      this.startTest();
    });
    
    document.getElementById('backToModeBtn').addEventListener('click', () => {
      window.quizController.showModeSelection(); 
    });
    
    this.attachCategoryHandlers(allCategories);
  }
  
  /**
   * Витягнути всі унікальні категорії з питань
   */
  extractCategories(questions) {
    const categories = new Set();
    questions.forEach(q => {
      if (q.category) {
        categories.add(q.category);
      }
    });
    return Array.from(categories).sort();
  }
  
  /**
   * Прив'язати обробники для вибору категорій
   */
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
    
    // Початкова перевірка
    updateSelectAll();
  }
  
  /**
   * Отримати налаштування від користувача
   * @returns {Object} об'єкт з налаштуваннями
   */
  getSetupConfig() {
    const selectedCategories = Array.from(document.querySelectorAll('.category-checkbox:checked'))
      .map(cb => cb.value);
      
    // Валідація кількості питань
    let requestedCount = parseInt(document.getElementById('questionCount')?.value) || this.allSupportedQuestions.length;
    requestedCount = Math.max(1, Math.min(requestedCount, this.allSupportedQuestions.length));
    
    return {
      repeatUnknown: document.getElementById('repeatUnknown')?.checked ?? false,
      shuffleQuestions: document.getElementById('shuffleQuestions')?.checked ?? true,
      questionCount: requestedCount,
      maxMistakes: parseInt(document.getElementById('maxMistakes')?.value) || 0,
      timeLimitMinutes: parseInt(document.getElementById('timeLimitMinutes')?.value) || 0,
      selectedCategories: selectedCategories,
      flipAnimation: true,
      showComment: true,
    };
  }

  // ==================== QUIZ (ТЕСТУВАННЯ) ====================
  
  startTest() {
    this.config = this.getSetupConfig();
    
    // 1. Фільтрація питань за вибраними категоріями
    let questions = this.allSupportedQuestions.filter(q => 
      this.config.selectedCategories.includes(q.category)
    );
    
    if (questions.length === 0) {
      alert('Будь ласка, оберіть хоча б одну категорію або налаштуйте фільтри.');
      return;
    }
    
    // 2. Перемішування
    if (this.config.shuffleQuestions) {
      questions = this.shuffle(questions);
    }
    
    // 3. Обмеження кількості питань
    this.testQuestions = questions.slice(0, this.config.questionCount);
    
    // 4. Ініціалізація стану
    this.currentQuestionIndex = 0;
    this.userResults = [];
    this.questionsToReview = this.config.repeatUnknown ? [...this.testQuestions] : [];
    this.knownQuestionsIds.clear();
    this.startTime = Date.now();
    this.mistakesCount = 0;
    
    // 5. Запуск таймера
    this.startTimer(this.config.timeLimitMinutes);
    
    // 6. Показати інтерфейс тесту
    window.quizController.showScreen('quiz');
    this.renderQuizInterface(document.getElementById('quiz'));
    
    // 7. Показати перше питання
    this.showQuestion(this.getNextQuestion());
  }
  
  startTimer(minutes) {
    if (this.timeLimitTimer) {
      clearInterval(this.timeLimitTimer);
    }
    
    if (minutes > 0) {
      this.remainingTime = minutes * 60; // час у секундах
      
      this.timeLimitTimer = setInterval(() => {
        this.remainingTime--;
        this.updateTimeUI();
        
        if (this.remainingTime <= 0) {
          clearInterval(this.timeLimitTimer);
          alert('⏰ Час вичерпано! Тестування завершено.');
          this.finishTest(true); 
        }
      }, 1000);
    } else {
      this.updateTimeUI(); 
    }
  }

  stopTimer() {
    if (this.timeLimitTimer) {
      clearInterval(this.timeLimitTimer);
      this.timeLimitTimer = null;
    }
  }

  updateTimeUI() {
    const timeEl = document.getElementById('timeCounter');
    if (!timeEl) return;
    
    if (this.config.timeLimitMinutes > 0) {
      const minutes = Math.floor(this.remainingTime / 60);
      const seconds = this.remainingTime % 60;
      timeEl.textContent = `⏳ ${minutes}:${seconds.toString().padStart(2, '0')}`;
    } else {
      timeEl.textContent = '⏳ Без ліміту';
    }
  }

  /**
   * Рендер інтерфейсу тестування
   * @param {HTMLElement} container - контейнер для рендерингу
   */
  renderQuizInterface(container) {
    this.clearContainer(container);
    
    container.innerHTML = `
      <div class="quiz-container flashcard-quiz-container">
        <div class="quiz-meta">
          <div class="meta-left">
            <span class="badge">📇 Флешкартки</span>
            <span class="badge" id="timeCounter"></span>
          </div>
          <div class="meta-right">
            <span class="badge badge-error" id="mistakesCounter">
              ❌ Помилок: 0${this.config.maxMistakes > 0 ? ` / ${this.config.maxMistakes}` : ''}
            </span>
          </div>
        </div>
        
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill" style="width: 0%"></div>
        </div>

        <div id="questionCardContainer">
          </div>

        <div class="quiz-actions">
          <button class="btn-ghost" id="endEarlyBtn">Завершити навчання</button>
        </div>
      </div>
    `;
    
    this.updateTimeUI();
    document.getElementById('endEarlyBtn').addEventListener('click', () => {
      if (confirm('Ви впевнені, що хочете завершити навчання?')) {
        this.finishTest();
      }
    });
  }

  /**
   * Отримати наступне питання (включаючи логіку повторення)
   */
  getNextQuestion() {
    if (this.config.repeatUnknown && this.questionsToReview.length > 0) {
      return this.questionsToReview.shift();
    }
    
    if (this.currentQuestionIndex >= this.testQuestions.length) {
      return null;
    }
    
    const question = this.testQuestions[this.currentQuestionIndex];
    this.currentQuestionIndex++;
    return question;
  }

  /**
   * Показати питання (рендеринг картки)
   * @param {Object} question - питання для відображення
   */
  showQuestion(question) {
    if (!question) {
      this.finishTest();
      return;
    }
    
    this.currentQuestion = question;
    this.isRevealed = false;
    
    this.currentAnswer = question.answers.find(a => a.isCorrect);
    if (!this.currentAnswer) {
      this.currentAnswer = { text: 'Відповідь не знайдена' };
    }
    
    const animationClass = this.config.flipAnimation ? 'with-animation' : '';
    const container = document.getElementById('questionCardContainer');
    
    const questionId = question.id || `q-${this.currentQuestionIndex}-${Date.now()}`;
    
    container.innerHTML = `
      <div class="flashcard-container ${animationClass}" data-question-id="${questionId}">
        <div class="flashcard" id="flashcard-${questionId}">
          
          <div class="flashcard-side flashcard-front">
            <div class="flashcard-content">
              <div class="flashcard-header">
                <span class="badge">${question.category || 'Загальна'}</span>
                <span class="badge">Картка ${this.currentQuestionIndex} / ${this.config.questionCount}</span>
              </div>
              
              <div class="flashcard-question">
                <h2>${question.question}</h2>
              </div>
              
              <div class="flashcard-hint">
                <p class="muted">💡 Спробуйте згадати відповідь перед тим як розкрити картку</p>
              </div>
              
              <div class="flashcard-action">
                <button class="btn-primary btn-large" id="revealBtn">
                  Показати відповідь
                </button>
              </div>
            </div>
          </div>
          
          <div class="flashcard-side flashcard-back">
            <div class="flashcard-content">
              <div class="flashcard-header">
                <span class="badge badge-success">✅ Відповідь</span>
              </div>
              
              <div class="flashcard-question-small">
                <strong>Питання:</strong>
                <p>${question.question}</p>
              </div>
              
              <div class="flashcard-answer">
                <h3>Відповідь:</h3>
                <p>${this.currentAnswer.text}</p>
              </div>
              
              ${this.config.showComment && question.comment ? `
                <div class="flashcard-comment">
                  <p class="muted"><strong>ℹ️ Коментар:</strong> ${question.comment}</p>
                </div>
              ` : ''}
              
              <div class="flashcard-separator"></div>
              
              <div class="flashcard-self-check">
                <h4>Ви знали цю відповідь?</h4>
                <div class="self-check-buttons">
                  <button class="btn-success btn-large" data-knew="true">
                    ✓ Знав
                  </button>
                  <button class="btn-error btn-large" data-knew="false">
                    ✗ Не знав
                  </button>
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    `;
    
    this.updateProgressUI();
    this.attachEventHandlers();
  }
  
  /**
   * Прив'язати обробники подій до елементів картки
   */
  attachEventHandlers() {
    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) {
      revealBtn.addEventListener('click', () => this.revealAnswer());
    }
    
    const selfCheckButtons = document.querySelectorAll('.self-check-buttons button');
    selfCheckButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const knew = e.target.dataset.knew === 'true';
        this.handleAnswer(knew);
      });
    });
  }
  
  /**
   * Показати відповідь (перевернути картку)
   */
  revealAnswer() {
    if (this.isRevealed) return;
    this.isRevealed = true;
    
    const questionId = this.currentQuestion.id || `q-${this.currentQuestionIndex}-${Date.now()}`;
    const flashcard = document.getElementById(`flashcard-${questionId}`);

    if (flashcard) {
      if (this.config.flipAnimation) {
        flashcard.classList.add('flipped');
      } else {
        const front = flashcard.querySelector('.flashcard-front');
        const back = flashcard.querySelector('.flashcard-back');
        if (front && back) {
          front.style.display = 'none';
          back.style.display = 'block';
        }
      }
    }
    
    const revealBtn = document.getElementById('revealBtn');
    if (revealBtn) {
      revealBtn.disabled = true;
    }
  }

  /**
   * Обробка відповіді користувача (самооцінка)
   */
  handleAnswer(knew) {
    document.querySelectorAll('.self-check-buttons button').forEach(btn => btn.disabled = true);
    
    const isCorrect = knew;
    
    const result = {
      questionId: this.currentQuestion.id,
      isCorrect: isCorrect,
      userAnswer: knew ? 'Знав відповідь' : 'Не знав відповідь',
      correctAnswer: this.currentAnswer.text,
      timestamp: Date.now(),
      timeTaken: (Date.now() - this.startTime) / 1000, 
    };
    
    this.userResults.push(result);
    
    if (!knew) {
      this.mistakesCount++;
      
      if (this.config.maxMistakes > 0 && this.mistakesCount >= this.config.maxMistakes) {
        alert(`❌ Ви досягли ліміту в ${this.config.maxMistakes} помилок! Тестування завершено.`);
        this.finishTest(true);
        return;
      }
      
      if (this.config.repeatUnknown && !this.questionsToReview.some(q => q.id === this.currentQuestion.id)) {
         this.questionsToReview.push(this.currentQuestion);
      }
    } else {
      this.knownQuestionsIds.add(this.currentQuestion.id);
    }
    
    this.updateMistakesUI();
    
    setTimeout(() => {
      this.showQuestion(this.getNextQuestion());
    }, 500);
  }
  
  finishTest(wasForced = false) {
    this.stopTimer(); 
    const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
    
    const results = {
      totalQuestions: this.testQuestions.length,
      answeredQuestions: this.userResults.length,
      knownCards: this.userResults.filter(r => r.isCorrect).length,
      mistakesCount: this.mistakesCount, 
      percentage: this.testQuestions.length > 0 ? Math.round((this.knownQuestionsIds.size / this.testQuestions.length) * 100) : 0,
      timeSpent,
      timeLimitReached: wasForced && this.remainingTime <= 0,
      mistakeLimitReached: wasForced && this.mistakesCount >= this.config.maxMistakes,
      questions: this.testQuestions,
      userAnswers: this.userResults,
      config: this.config
    };
    
    window.quizController.saveResults(results);
    window.quizController.showScreen('results');
    this.renderResults(document.getElementById('results'), results);
  }

  // ==================== RESULTS (РЕЗУЛЬТАТИ) ====================
  
  /**
   * Рендер екрану результатів
   * @param {HTMLElement} container - контейнер для рендерингу
   * @param {Object} results - об'єкт з результатами тесту
   */
  renderResults(container, results) {
    const totalCards = results.totalQuestions;
    const knownCards = results.knownCards;
    const knowledgeRate = results.percentage;
    const mistakes = results.mistakesCount;
    const isSuccess = !results.timeLimitReached && !results.mistakeLimitReached && (totalCards === 0 || knowledgeRate >= 70);

    let statusText = '';
    if (results.timeLimitReached) {
      statusText = '❌ Тестування завершено: Вичерпано час!';
    } else if (results.mistakeLimitReached) {
      statusText = `❌ Тестування завершено: Досягнуто ліміту (${results.config.maxMistakes}) помилок!`;
    } else if (knownCards === 0 && results.answeredQuestions > 0) {
      statusText = '🤔 Схоже, потрібне повторення';
    } else if (knowledgeRate === 100) {
      statusText = '🥳 Ідеальний результат!';
    } else if (knowledgeRate >= 70) {
      statusText = '👍 Відмінний результат!';
    } else {
      statusText = 'Потрібне повторення';
    }

    container.innerHTML = `
      <div class="results-container">
        <div class="results-header ${isSuccess ? 'success' : 'fail'}">
          <div class="results-icon">📇</div>
          <h1 class="results-percentage">${knowledgeRate}%</h1>
          <p class="results-status">${statusText}</p>
        </div>
        
        <div class="results-stats">
          <div class="stat-card">
            <div class="stat-value">${knownCards} / ${totalCards}</div>
            <div class="stat-label">Картки, які знав</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-value">${mistakes}</div>
            <div class="stat-label">Картки, які не знав</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-value">${Math.floor(results.timeSpent / 60)}:${(results.timeSpent % 60).toString().padStart(2, '0')}</div>
            <div class="stat-label">Витрачено часу</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-value">${results.answeredQuestions}</div>
            <div class="stat-label">Питань пройдено</div>
          </div>
        </div>
        
        <div class="results-actions">
          <button class="btn-primary" id="retakeBtn">🔄 Повторити</button>
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
  
  // ==================== HELPER МЕТОДИ ====================
  
  /**
   * Оновити прогрес в UI
   */
  updateProgressUI() {
    const totalCards = this.testQuestions.length;
    const knownCards = this.knownQuestionsIds.size;
    const percentage = totalCards > 0 ? Math.round((knownCards / totalCards) * 100) : 0;

    const progressBar = document.querySelector('.progress-fill');
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
  }

  /**
   * Оновити лічильник помилок
   */
  updateMistakesUI() {
    const counterEl = document.getElementById('mistakesCounter');
    if (counterEl) {
      const max = this.config.maxMistakes;
      counterEl.textContent = `❌ Помилок: ${this.mistakesCount}${max > 0 ? ` / ${max}` : ''}`;
      counterEl.classList.toggle('critical', max > 0 && this.mistakesCount >= max * 0.8);
    }
  }

  /**
   * Перемішати масив
   */
  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  /**
   * Заглушка для checkAnswer (повертає те, що дав користувач, "знав" = true)
   */
  checkAnswer(question, userAnswer) {
    return userAnswer === true;
  }
}