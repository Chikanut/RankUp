/**
 * MultipleChoicePlugin - режим тестування з вибором варіантів відповіді
 */

import BasePlugin from './base-plugin.js';

export default class MultipleChoicePlugin extends BasePlugin {
  
  constructor() {
    super();
    this.currentQuestionIndex = 0;
    this.userAnswers = [];
    this.questions = [];
    this.config = {};
    this.startTime = null;
    this.timer = null;
  }
  
  // ==================== МЕТАДАНІ ====================
  
  static get metadata() {
    return {
      id: 'multiple-choice',
      name: 'Вибір з варіантів',
      icon: '📝',
      description: 'Класичні питання з декількома варіантами відповіді'
    };
  }
  
  // ==================== ВАЛІДАЦІЯ ====================
  
  static supportsQuestion(question) {
    // Перевірка базових полів
    if (!question || typeof question !== 'object') return false;
    if (!question.question || typeof question.question !== 'string') return false;
    
    // Перевірка відповідей
    if (!Array.isArray(question.answers)) return false;
    if (question.answers.length < 2) return false;
    
    // Кожна відповідь має text та isCorrect
    const validAnswers = question.answers.every(a => 
      a.text && 
      typeof a.text === 'string' && 
      typeof a.isCorrect === 'boolean'
    );
    if (!validAnswers) return false;
    
    // Є хоча б одна правильна відповідь
    const hasCorrect = question.answers.some(a => a.isCorrect === true);
    if (!hasCorrect) return false;
    
    return true;
  }
  
  // ==================== SETUP (НАЛАШТУВАННЯ) ====================
  
  renderSetup(container, testData, questions) {
    this.questions = questions;
    const categories = [...new Set(questions.map(q => q.category))];
    
    container.innerHTML = `
      <div class="setup-container">
        <h2>⚙️ Налаштування тесту</h2>
        <p class="muted">Тема: ${testData.meta.title}</p>
        <p class="muted">Доступно питань: ${questions.length}</p>
        
        <div class="setup-grid">
          <!-- Основні налаштування -->
          <div class="setup-section">
            <h3>Основні параметри</h3>
            
            <div class="form-group">
              <label for="questionCount">Кількість питань</label>
              <input 
                type="number" 
                id="questionCount" 
                min="5" 
                max="${questions.length}" 
                value="${Math.min(25, questions.length)}"
              />
              <span class="hint">Максимум: ${questions.length}</span>
            </div>
            
            <div class="form-group">
              <label for="timeLimit">Обмеження часу (хвилин)</label>
              <input 
                type="number" 
                id="timeLimit" 
                min="5" 
                max="180" 
                value="30"
              />
              <span class="hint">0 = без обмеження</span>
            </div>
            
            <div class="form-group">
              <label for="maxMistakes">Максимум помилок (0 = без обмеження)</label>
              <input 
                type="number" 
                id="maxMistakes" 
                min="0" 
                max="50" 
                value="0"
              />
              <span class="hint">Тест завершиться після досягнення ліміту</span>
            </div>
          </div>
          
          <!-- Опції -->
          <div class="setup-section">
            <h3>Додаткові опції</h3>
            
            <div class="checkbox-group">
              <input type="checkbox" id="shuffleQuestions" checked />
              <label for="shuffleQuestions">
                <strong>Перемішати питання</strong>
                <span class="hint">Випадковий порядок питань</span>
              </label>
            </div>
            
            <div class="checkbox-group">
              <input type="checkbox" id="shuffleAnswers" checked />
              <label for="shuffleAnswers">
                <strong>Перемішати відповіді</strong>
                <span class="hint">Випадковий порядок варіантів</span>
              </label>
            </div>
            
            <div class="checkbox-group">
              <input type="checkbox" id="showComments" checked />
              <label for="showComments">
                <strong>Показувати коментарі</strong>
                <span class="hint">Пояснення після кожної відповіді</span>
              </label>
            </div>
            
            <div class="checkbox-group">
              <input type="checkbox" id="priorityMistakes" />
              <label for="priorityMistakes">
                <strong>Пріоритет питань з помилками</strong>
                <span class="hint">Працює якщо є історія проходжень</span>
              </label>
            </div>
          </div>
          
          <!-- Вибір категорій -->
          <div class="setup-section full-width">
            <h3>Категорії для тестування</h3>
            <p class="hint">Оберіть які розділи включити в тест</p>
            
            <div class="categories-grid" id="categoriesGrid">
              ${categories.map(cat => {
                const count = questions.filter(q => q.category === cat).length;
                return `
                  <div class="category-item">
                    <input 
                      type="checkbox" 
                      id="cat-${cat}" 
                      value="${cat}" 
                      checked 
                    />
                    <label for="cat-${cat}">
                      <strong>${cat}</strong>
                      <span class="badge">${count} питань</span>
                    </label>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
        
        <div class="setup-actions">
          <button class="btn-primary btn-large" id="startTestBtn">
            🚀 Почати тест
          </button>
          <button class="btn-ghost" id="backToModeBtn">
            ← Назад до вибору режиму
          </button>
        </div>
      </div>
    `;
    
    // Додати обробники
    document.getElementById('startTestBtn').addEventListener('click', () => {
      this.startTest();
    });
    
    document.getElementById('backToModeBtn').addEventListener('click', () => {
      window.quizController.showModeSelection();
    });
  }
  
  getSetupConfig() {
    const selectedCategories = Array.from(
      document.querySelectorAll('#categoriesGrid input:checked')
    ).map(cb => cb.value);
    
    return {
      questionCount: parseInt(document.getElementById('questionCount').value),
      timeLimit: parseInt(document.getElementById('timeLimit').value),
      maxMistakes: parseInt(document.getElementById('maxMistakes').value),
      shuffleQuestions: document.getElementById('shuffleQuestions').checked,
      shuffleAnswers: document.getElementById('shuffleAnswers').checked,
      showComments: document.getElementById('showComments').checked,
      priorityMistakes: document.getElementById('priorityMistakes').checked,
      selectedCategories
    };
  }
  
  // ==================== QUIZ (ТЕСТУВАННЯ) ====================
  
  startTest() {
    this.config = this.getSetupConfig();
    
    // Фільтрувати по категоріях
    let filteredQuestions = this.questions.filter(q =>
      this.config.selectedCategories.includes(q.category)
    );
    
    if (filteredQuestions.length === 0) {
      alert('Оберіть хоча б одну категорію!');
      return;
    }
    
    // Перемішати якщо потрібно
    if (this.config.shuffleQuestions) {
      filteredQuestions = this.shuffle(filteredQuestions);
    }
    
    // Взяти потрібну кількість
    this.questions = filteredQuestions.slice(0, this.config.questionCount);
    
    // Ініціалізувати
    this.currentQuestionIndex = 0;
    this.userAnswers = new Array(this.questions.length).fill(null);
    this.mistakesCount = 0;
    this.correctCount = 0;
    this.startTime = Date.now();
    
    // Показати інтерфейс тесту
    window.quizController.showScreen('quiz');
    this.renderQuizInterface(document.getElementById('quiz'));
    
    // Запустити таймер
    if (this.config.timeLimit > 0) {
      this.startTimer();
    }
    
    // Показати перше питання
    this.showQuestion(this.questions[0], 0);
  }
  
  renderQuizInterface(container) {
    container.innerHTML = `
      <div class="quiz-container">
        <!-- Мета-інформація -->
        <div class="quiz-meta">
          <div class="meta-left">
            <span class="badge" id="questionCounter">
              Питання 1 / ${this.questions.length}
            </span>
            <span class="badge ${this.config.timeLimit > 0 ? '' : 'hidden'}" id="timerDisplay">
              ⏱️ ${this.config.timeLimit}:00
            </span>
          </div>
          <div class="meta-right">
            <span class="badge badge-success" id="correctCounter">
              ✓ Правильно: 0
            </span>
            <span class="badge badge-error" id="mistakesCounter">
              ✗ Помилок: 0
            </span>
          </div>
        </div>
        
        <!-- Прогрес бар -->
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill" style="width: 0%"></div>
        </div>
        
        <!-- Картка питання -->
        <div class="question-card" id="questionCard">
          <div class="question-header">
            <span class="question-category" id="questionCategory"></span>
            <span class="question-difficulty" id="questionDifficulty"></span>
          </div>
          
          <h2 class="question-text" id="questionText"></h2>
          
          <div class="answers-list" id="answersList"></div>
          
          <div class="answer-comment hidden" id="answerComment"></div>
          
          <div class="question-actions">
            <button class="btn-primary hidden" id="nextBtn">
              Далі →
            </button>
          </div>
        </div>
        
        <!-- Дії -->
        <div class="quiz-actions">
          <button class="btn-ghost" id="endEarlyBtn">Завершити достроково</button>
        </div>
      </div>
    `;
    
    // Обробники
    document.getElementById('endEarlyBtn').addEventListener('click', () => {
      if (confirm('Ви впевнені що хочете завершити тест?')) {
        this.finishTest();
      }
    });
    
    document.getElementById('nextBtn').addEventListener('click', () => {
      this.nextQuestion();
    });
  }
  
  showQuestion(question, index) {
    this.currentQuestionIndex = index;
    
    // Оновити мета
    document.getElementById('questionCounter').textContent = 
      `Питання ${index + 1} / ${this.questions.length}`;
    
    document.getElementById('questionCategory').textContent = question.category;
    
    const difficultyMap = { 1: 'Легко', 2: 'Середньо', 3: 'Складно' };
    document.getElementById('questionDifficulty').textContent = 
      difficultyMap[question.difficulty] || '';
    
    // Оновити прогрес
    const progress = ((index) / this.questions.length) * 100;
    document.getElementById('progressFill').style.width = `${progress}%`;
    
    // Показати питання
    document.getElementById('questionText').textContent = question.question;
    
    // Показати відповіді
    let answers = [...question.answers];
    if (this.config.shuffleAnswers) {
      answers = this.shuffle(answers);
    }
    
    const answersList = document.getElementById('answersList');
    answersList.innerHTML = answers.map((answer, idx) => `
      <button class="answer-btn" data-index="${question.answers.indexOf(answer)}">
        ${answer.text}
      </button>
    `).join('');
    
    // Приховати коментар та кнопку далі
    document.getElementById('answerComment').classList.add('hidden');
    document.getElementById('nextBtn').classList.add('hidden');
    
    // Обробники відповідей
    answersList.querySelectorAll('.answer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.handleAnswer(question, parseInt(e.target.dataset.index), e.target);
      });
    });
  }
  
  handleAnswer(question, answerIndex, button) {
    // Заблокувати всі кнопки
    document.querySelectorAll('.answer-btn').forEach(btn => {
      btn.disabled = true;
    });
    
    const isCorrect = question.answers[answerIndex].isCorrect;
    
    // Зберегти відповідь
    this.userAnswers[this.currentQuestionIndex] = {
      questionId: question.id,
      answerIndex,
      isCorrect,
      timestamp: Date.now()
    };
    
    // Оновити статистику
    if (isCorrect) {
      this.correctCount++;
      button.classList.add('correct');
    } else {
      this.mistakesCount++;
      button.classList.add('wrong');
      
      // Показати правильну відповідь
      document.querySelectorAll('.answer-btn').forEach((btn, idx) => {
        if (question.answers[parseInt(btn.dataset.index)].isCorrect) {
          btn.classList.add('correct');
        }
      });
    }
    
    // Оновити лічильники
    document.getElementById('correctCounter').textContent = `✓ Правильно: ${this.correctCount}`;
    document.getElementById('mistakesCounter').textContent = `✗ Помилок: ${this.mistakesCount}`;
    
    // Показати коментар
    if (this.config.showComments && question.comment) {
      const commentEl = document.getElementById('answerComment');
      commentEl.innerHTML = `
        <div class="comment-icon">${isCorrect ? '✅' : '❌'}</div>
        <div class="comment-text">${question.comment}</div>
      `;
      commentEl.classList.remove('hidden');
    }
    
    // Перевірити чи досягнуто ліміт помилок
    if (this.config.maxMistakes > 0 && this.mistakesCount >= this.config.maxMistakes) {
      setTimeout(() => {
        alert(`Досягнуто максимум помилок (${this.config.maxMistakes}). Тест завершено.`);
        this.finishTest();
      }, 1500);
      return;
    }
    
    // Показати кнопку далі
    document.getElementById('nextBtn').classList.remove('hidden');
  }
  
  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.showQuestion(this.questions[this.currentQuestionIndex + 1], this.currentQuestionIndex + 1);
    } else {
      this.finishTest();
    }
  }
  
  startTimer() {
    const endTime = Date.now() + (this.config.timeLimit * 60 * 1000);
    
    this.timer = setInterval(() => {
      const remaining = endTime - Date.now();
      
      if (remaining <= 0) {
        clearInterval(this.timer);
        alert('Час вийшов!');
        this.finishTest();
        return;
      }
      
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      
      document.getElementById('timerDisplay').textContent = 
        `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
  }
  
  finishTest() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
    
    const results = {
      totalQuestions: this.questions.length,
      answeredQuestions: this.userAnswers.filter(a => a !== null).length,
      correctCount: this.correctCount,
      mistakesCount: this.mistakesCount,
      percentage: Math.round((this.correctCount / this.questions.length) * 100),
      timeSpent,
      questions: this.questions,
      userAnswers: this.userAnswers,
      config: this.config
    };
    
    // Зберегти результат
    window.quizController.saveResults(results);
    
    // Показати результати
    window.quizController.showScreen('results');
    this.renderResults(document.getElementById('results'), results);
  }
  
  // ==================== RESULTS (РЕЗУЛЬТАТИ) ====================
  
  renderResults(container, results) {
    const passed = results.percentage >= 70;
    
    container.innerHTML = `
      <div class="results-container">
        <div class="results-header ${passed ? 'success' : 'fail'}">
          <div class="results-icon">${passed ? '🎉' : '📊'}</div>
          <h1 class="results-percentage">${results.percentage}%</h1>
          <p class="results-status">${passed ? 'Тест здано!' : 'Потрібно покращити результат'}</p>
        </div>
        
        <div class="results-stats">
          <div class="stat-card">
            <div class="stat-value">${results.correctCount}</div>
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
            <div class="stat-label">Питань пройдено</div>
          </div>
        </div>
        
        <div class="results-actions">
          <button class="btn-primary" id="retakeBtn">🔄 Пройти ще раз</button>
          <button class="btn-ghost" id="backToTestsBtn">← Назад до тестів</button>
          <button class="btn-ghost" id="viewDetailsBtn">📊 Детальна статистика</button>
        </div>
      </div>
    `;
    
    // Обробники
    document.getElementById('retakeBtn').addEventListener('click', () => {
      window.quizController.showScreen('setup');
      this.renderSetup(
        document.getElementById('setup'),
        window.quizController.testData,
        window.quizController.currentPlugin.constructor.filterQuestions(
          window.quizController.testData.questions
        )
      );
    });
    
    document.getElementById('backToTestsBtn').addEventListener('click', () => {
      window.location.href = 'index.html';
    });
    
    document.getElementById('viewDetailsBtn').addEventListener('click', () => {
      alert('Детальна статистика буде реалізована пізніше');
    });
  }
  
  // ==================== HELPER МЕТОДИ ====================
  
  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
