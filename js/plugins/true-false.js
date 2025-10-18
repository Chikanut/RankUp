/**
 * TrueFalsePlugin - режим тестування "Правда чи Неправда"
 */

import BasePlugin from './base-plugin.js';

export default class TrueFalsePlugin extends BasePlugin {
  
  // ==================== МЕТАДАНІ, ВАЛІДАЦІЯ, КОНСТРУКТОР (без змін) ====================
  
  static get metadata() {
    return {
      id: 'true-false',
      name: 'Правда-Неправда',
      icon: '⚖️',
      description: 'Випадкове твердження: чи є воно правильним?'
    };
  }
  
  static supportsQuestion(question) {
    if (!question || typeof question !== 'object') return false;
    if (!question.question || typeof question.question !== 'string') return false;
    if (!Array.isArray(question.answers) || question.answers.length === 0) return false;
    const hasCorrect = question.answers.some(a => a.isCorrect === true);
    return hasCorrect; 
  }
  
  static filterQuestions(questions) {
    return questions.filter(q => this.supportsQuestion(q));
  }
  
  constructor() {
    super();
    this.currentQuestion = null;
    this.currentQuestionIndex = 0;
    this.userAnswers = [];
    this.allSupportedQuestions = []; 
    this.testQuestions = [];         
    this.config = {};
    this.startTime = null;
    this.timer = null;
    this.remainingTime = 0;
    this.currentQuestionData = null; 
  }
  
  // ==================== SETUP (без змін) ====================
  
  renderSetup(container, testData, questions) {
    this.allSupportedQuestions = questions;
    const allCategories = this.extractCategories(questions);
    const maxQuestions = questions.length;
    
    const defaultSettings = {
      shuffleQuestions: true,
      questionCount: Math.min(20, maxQuestions),
      timeLimitMinutes: 0,
      selectedCategories: allCategories, 
    };
    
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
        <h2>⚙️ Налаштування Режиму Правда-Неправда</h2>
        <p class="muted">Тема: ${testData.meta.title}</p>
        <p class="muted" id="questionCountInfo">Доступно питань: ${maxQuestions}</p>
        
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
            <h3>Опції Тесту</h3>
            
            <div class="input-group">
              <label for="questionCount">🔢 Кількість питань:</label>
              <input type="number" id="questionCount" min="1" max="${maxSelectable}" value="${Math.min(settings.questionCount, maxSelectable)}" />
              <span class="hint">Кількість тверджень для проходження. (Макс. ${maxQuestions})</span>
            </div>
            
            <div class="input-group">
              <label for="timeLimitMinutes">⏳ Ліміт часу (хв):</label>
              <input type="number" id="timeLimitMinutes" min="0" value="${settings.timeLimitMinutes}" />
              <span class="hint">Час, відведений на проходження. 0 = без ліміту.</span>
            </div>
            
            <h3 class="mt-4">Опції режиму</h3>
            <div class="checkbox-group">
              <input type="checkbox" id="shuffleQuestions" ${settings.shuffleQuestions ? 'checked' : ''} />
              <label for="shuffleQuestions">
                <strong>🔀 Перемішати твердження</strong>
                <span class="hint">Випадковий порядок питань.</span>
              </label>
            </div>

            <p class="muted mt-3">Твердження генеруються збалансовано (50% Правда / 50% Неправда).</p>
          </div>
        </div>

        <div class="setup-actions">
          <button class="btn-primary btn-large" id="startTrueFalseTestBtn">
            🚀 Почати Тест
          </button>
          <button class="btn-ghost" id="backToModeBtn">
            ← Назад до вибору режиму
          </button>
        </div>
      </div>
    `;
    
    document.getElementById('startTrueFalseTestBtn').addEventListener('click', () => {
      this.startTest();
    });
    
    document.getElementById('backToModeBtn').addEventListener('click', () => {
      window.quizController.showModeSelection(); 
    });
    
    this.attachCategoryHandlers(allCategories);
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
  
  getSetupConfig() {
    const selectedCategories = Array.from(document.querySelectorAll('.category-checkbox:checked'))
      .map(cb => cb.value);
      
    let requestedCount = parseInt(document.getElementById('questionCount')?.value) || 0;
    requestedCount = Math.max(1, Math.min(requestedCount, this.allSupportedQuestions.length));
    
    return {
      shuffleQuestions: document.getElementById('shuffleQuestions')?.checked ?? true,
      questionCount: requestedCount,
      timeLimitMinutes: parseInt(document.getElementById('timeLimitMinutes')?.value) || 0,
      selectedCategories: selectedCategories,
    };
  }

  // ==================== QUIZ (ТЕСТУВАННЯ) ====================
  
  startTest() {
    this.config = this.getSetupConfig();
    
    let questions = this.allSupportedQuestions.filter(q => 
      this.config.selectedCategories.includes(q.category)
    );
    
    if (questions.length === 0 || this.config.questionCount === 0) {
      alert('Будь ласка, оберіть хоча б одну категорію та вкажіть кількість питань.');
      return;
    }
    
    if (this.config.shuffleQuestions) {
      questions = this.shuffle(questions);
    }
    
    this.testQuestions = questions.slice(0, this.config.questionCount);
    
    this.currentQuestionIndex = 0;
    this.userAnswers = [];
    this.startTime = Date.now();
    
    this.startTimer(this.config.timeLimitMinutes);
    
    window.quizController.showScreen('quiz');
    this.renderQuizInterface(document.getElementById('quiz'));
    
    this.showQuestion(this.testQuestions[this.currentQuestionIndex]);
  }
  
  startTimer(minutes) {
    if (this.timer) clearInterval(this.timer);
    if (minutes > 0) {
      this.remainingTime = minutes * 60;
      this.timer = setInterval(() => {
        this.remainingTime--;
        this.updateTimeUI();
        if (this.remainingTime <= 0) {
          clearInterval(this.timer);
          alert('⏰ Час вичерпано! Тестування завершено.');
          this.finishTest();
        }
      }, 1000);
    } else {
      this.updateTimeUI();
    }
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
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

  generateTrueFalseStatement(question) {
    const isTrueStatement = Math.random() < 0.5; 
    
    const correctAnswers = question.answers.filter(a => a.isCorrect);
    const incorrectAnswers = question.answers.filter(a => !a.isCorrect);
    
    let statementAnswer = null; 
    
    if (isTrueStatement) {
      statementAnswer = this.getRandomElement(correctAnswers);
    } else {
      if (incorrectAnswers.length > 0) {
        statementAnswer = this.getRandomElement(incorrectAnswers); 
      } else {
        const otherQuestions = this.testQuestions.filter(q => q.id !== question.id);
        if (otherQuestions.length > 0) {
          const randomOtherQuestion = this.getRandomElement(otherQuestions);
          const otherCorrectAnswers = randomOtherQuestion.answers.filter(a => a.isCorrect);
          if (otherCorrectAnswers.length > 0) {
            statementAnswer = this.getRandomElement(otherCorrectAnswers);
          }
        }
        if (!statementAnswer) {
           statementAnswer = this.getRandomElement(question.answers);
        }
      }
    }
    
    if (!statementAnswer) {
        return {
           statement: `Твердження не може бути сформоване для: ${question.question}`,
           expectedAnswer: false, 
           correctAnswer: 'Помилка генерації',
           isTrue: false,
           originalAnswer: {text: 'Помилка'}
        };
    }

    const statement = `${question.question} — це "${statementAnswer.text}".`;
    
    return {
      statement: statement,
      expectedAnswer: isTrueStatement, 
      correctAnswer: this.getRandomElement(correctAnswers).text, 
      isTrue: isTrueStatement,
      originalAnswer: statementAnswer,
    };
  }

  /**
   * Рендер інтерфейсу тестування.
   * * Корекція: обробник endEarlyBtn перевірено.
   */
  renderQuizInterface(container) {
    this.clearContainer(container);
    
    container.innerHTML = `
      <div class="quiz-container multiple-choice-quiz-container">
        <div class="quiz-meta">
          <div class="meta-left">
            <span class="badge">⚖️ Правда-Неправда</span>
            <span class="badge" id="timeCounter"></span>
          </div>
          <div class="meta-right">
            <span class="badge" id="progressText"></span>
          </div>
        </div>
        
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill" style="width: 0%"></div>
        </div>

        <div id="questionContainer">
          </div>

        <div class="quiz-actions">
          <button class="btn-ghost" id="endEarlyBtn">Завершити тест</button>
        </div>
      </div>
    `;
    
    // Обробник для дострокового завершення тесту
    document.getElementById('endEarlyBtn').addEventListener('click', () => {
      // Виклик confirm тут критичний, якщо він не працює, то це проблема середовища
      if (confirm('Ви впевнені, що хочете завершити тест?')) {
        // Додатково перевіряємо, чи ми ще на екрані тесту, хоча finishTest це зробить
        this.finishTest(); 
      }
    });
  }

  showQuestion(question) {
    // Цей блок перевірки тепер фактично не потрібен, бо його робить showNextQuestionButton,
    // але залишаємо як захист
    if (!question) {
      this.finishTest();
      return;
    }
    
    this.currentQuestion = question;
    this.currentQuestionData = this.generateTrueFalseStatement(question);
    
    const container = document.getElementById('questionContainer');
    
    // ... (Рендеринг питання - без змін)
     container.innerHTML = `
      <div class="question-card" id="currentQuestionCard">
        <span class="question-number">Твердження ${this.currentQuestionIndex + 1} / ${this.testQuestions.length}</span>
        ${question.category ? `<span class="question-category">${question.category}</span>` : ''}
        
        <h2 class="question-text">${this.currentQuestionData.statement}</h2>
        
        <div class="true-false-options" id="answerOptions">
          <button class="btn-option btn-large" data-answer="true">
            Правда
          </button>
          <button class="btn-option btn-large" data-answer="false">
            Неправда
          </button>
        </div>
        
        <div id="answerComment" style="display: none;" class="answer-comment"></div>
        
        <div id="nextButtonPlaceholder"></div> 
      </div>
    `;
    
    this.updateProgressUI();
    this.attachEventHandlers();
  }
  
  attachEventHandlers() {
    const optionsContainer = document.getElementById('answerOptions');
    if (optionsContainer) {
      optionsContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && !e.target.disabled) {
          const userAnswer = e.target.dataset.answer === 'true';
          this.handleAnswer(userAnswer, e.target);
        }
      });
    }
  }

  handleAnswer(userAnswer, selectedButton) {
    document.querySelectorAll('#answerOptions button').forEach(btn => btn.disabled = true);
    
    const result = this.checkAnswer(this.currentQuestion, userAnswer);
    
    const correctButton = document.querySelector(`button[data-answer="${this.currentQuestionData.expectedAnswer}"]`);
    
    selectedButton.classList.add(result.isCorrect ? 'btn-success' : 'btn-error');
    if (!result.isCorrect && correctButton) {
      correctButton.classList.add('btn-success');
    }
    
    this.userAnswers.push({
      questionId: this.currentQuestion.id,
      isCorrect: result.isCorrect,
      userAnswer: userAnswer,
      correctAnswer: this.currentQuestionData.expectedAnswer,
      timestamp: Date.now(),
      timeTaken: (Date.now() - this.startTime) / 1000, 
    });
    
    this.showComment(this.currentQuestion, result.isCorrect, this.currentQuestionData);

    this.showNextQuestionButton();
  }

  /**
   * Рендер кнопки "Наступне твердження" та прив'язка обробника.
   * * КОРЕКЦІЯ: Чітка перевірка кінця тесту.
   */
  showNextQuestionButton() {
    const placeholder = document.getElementById('nextButtonPlaceholder');
    if (!placeholder) return;
    
    // Визначаємо текст кнопки
    const isLastQuestion = this.currentQuestionIndex === this.testQuestions.length - 1;
    const buttonText = isLastQuestion ? 'Завершити тест' : 'Наступне твердження →';
    
    placeholder.innerHTML = `
      <div class="next-question-action mt-4">
        <button class="btn-primary btn-large" id="nextQuestionBtn">
          ${buttonText}
        </button>
      </div>
    `;

    // Прив'язка обробника для переходу
    document.getElementById('nextQuestionBtn').addEventListener('click', () => {
      // Перевіряємо, чи це не останнє питання
      if (this.currentQuestionIndex < this.testQuestions.length - 1) {
        this.currentQuestionIndex++;
        this.showQuestion(this.testQuestions[this.currentQuestionIndex]);
      } else {
        // Це останнє питання, викликаємо завершення тесту
        this.finishTest();
      }
    });
  }
  
  checkAnswer(question, userAnswer) {
    const isCorrect = userAnswer === this.currentQuestionData.expectedAnswer;
    return {
      isCorrect,
      userAnswer: userAnswer,
      correctAnswer: this.currentQuestionData.expectedAnswer
    };
  }

  showComment(question, wasCorrect, questionData) {
    const commentEl = document.getElementById('answerComment');
    if (!commentEl) return;
    
    const icon = wasCorrect ? '✅' : '❌';
    let statusText = wasCorrect ? 'Правильно! ' : 'Неправильно. ';
    
    if (questionData.isTrue) {
        statusText += `Твердження було **Правдою**, оскільки **"${questionData.originalAnswer.text}"** є правильною відповіддю на питання **"${question.question}"**.`;
    } else {
        statusText += `Твердження було **Неправдою**, оскільки **"${questionData.originalAnswer.text}"** не є правильною відповіддю на питання **"${question.question}"** (правильна відповідь: **"${questionData.correctAnswer}"**).`;
    }

    if (question.comment) {
      statusText += `<br><br>ℹ️ **Коментар:** ${question.comment}`;
    }
    
    commentEl.innerHTML = `
      <div class="comment-icon">${icon}</div>
      <div class="comment-text">${statusText}</div>
    `;
    commentEl.style.display = 'block';
  }
  
  finishTest() {
    this.stopTimer(); 
    const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
    const correctCount = this.userAnswers.filter(a => a.isCorrect).length;
    
    const results = {
      pluginId: this.constructor.metadata.id,
      
      totalQuestions: this.testQuestions.length,
      answeredQuestions: this.userAnswers.length, 
      correctCount: correctCount,
      mistakesCount: this.userAnswers.length - correctCount,
      percentage: this.testQuestions.length > 0 
                  ? Math.round((correctCount / this.testQuestions.length) * 100) 
                  : 0,
      timeSpent,
      
      // КОРЕКЦІЯ БАГУ: Додаємо масив питань (testQuestions),
      // щоб quiz-controller.js міг викликати forEach
      questions: this.testQuestions, 
      
      userAnswers: this.userAnswers, 
      config: this.config,
      timestamp: Date.now(),
    };
    
    // Викликається лише один раз, передаючи агрегований об'єкт
    window.quizController.saveResults(results); 
    
    // Після успішного збереження результатів, переходимо на екран результатів
    window.quizController.showScreen('results');
    this.renderResults(document.getElementById('results'), results);
  }

  // ==================== RESULTS ТА HELPER МЕТОДИ (без змін) ====================
  
  renderResults(container, results) {
    const isSuccess = results.percentage >= 70;

    container.innerHTML = `
      <div class="results-container">
        <div class="results-header ${isSuccess ? 'success' : 'fail'}">
          <div class="results-icon">⚖️</div>
          <h1 class="results-percentage">${results.percentage}%</h1>
          <p class="results-status">${isSuccess ? 'Відмінний результат!' : 'Потрібно повторити'}</p>
        </div>
        
        <div class="results-stats">
          <div class="stat-card">
            <div class="stat-value">${results.correctCount} / ${results.answeredQuestions}</div>
            <div class="stat-label">Правильних відповідей</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-value">${results.mistakesCount}</div>
            <div class="stat-label">Помилок</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-value">${Math.floor(results.timeSpent / 60)}:${(results.timeSpent % 60).toString().padStart(2, '0')}</div>
            <div class="stat-label">Витрачено часу</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-value">${results.answeredQuestions} / ${results.totalQuestions}</div>
            <div class="stat-label">Тверджень пройдено</div>
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
  
  updateProgressUI() {
    const total = this.testQuestions.length;
    const current = this.currentQuestionIndex;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    const progressBar = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }
    
    if (progressText) {
      progressText.textContent = `${current} / ${total} пройдено`;
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
}