/**
 * BasePlugin - базовий клас для всіх плагінів режимів тестування
 * Кожен плагін повинен розширювати цей клас та реалізувати всі методи
 */

export default class BasePlugin {
  
  /**
   * Метадані плагіна
   * @returns {Object} { id, name, icon, description }
   */
  static get metadata() {
    throw new Error('metadata getter must be implemented');
  }
  
  /**
   * Валідація всього тесту - чи підтримує плагін цей тест
   * @param {Object} testData - повні дані тесту з meta та questions
   * @returns {Object} { valid: boolean, supportedCount: number, totalCount: number, reason?: string }
   */
  static validate(testData) {
    if (!testData?.questions || !Array.isArray(testData.questions)) {
      return { 
        valid: false, 
        supportedCount: 0,
        totalCount: 0,
        reason: 'Немає масиву питань' 
      };
    }
    
    // Підрахувати підтримувані питання
    const supportedQuestions = testData.questions.filter(q => 
      this.supportsQuestion(q)
    );
    
    const supportedCount = supportedQuestions.length;
    const totalCount = testData.questions.length;
    
    // Якщо хоча б 1 питання підтримується - валідний
    if (supportedCount === 0) {
      return {
        valid: false,
        supportedCount: 0,
        totalCount,
        reason: 'Жодне питання не підтримується цим режимом'
      };
    }
    
    return { 
      valid: true, 
      supportedCount,
      totalCount,
      percentage: Math.round((supportedCount / totalCount) * 100)
    };
  }
  
  /**
   * Валідація окремого питання
   * @param {Object} question - одне питання
   * @returns {boolean} true якщо плагін може працювати з цим питанням
   */
  static supportsQuestion(question) {
    throw new Error('supportsQuestion() must be implemented');
  }
  
  /**
   * Відфільтрувати тільки підтримувані питання
   * @param {Array} questions - масив всіх питань
   * @returns {Array} масив підтримуваних питань
   */
  static filterQuestions(questions) {
    return questions.filter(q => this.supportsQuestion(q));
  }
  
  // ==================== МЕТОДИ РЕНДЕРИНГУ ====================
  
  /**
   * Рендер інтерфейсу налаштувань тесту
   * @param {HTMLElement} container - контейнер для рендерингу
   * @param {Object} testData - дані тесту
   * @param {Array} questions - відфільтровані питання
   */
  renderSetup(container, testData, questions) {
    throw new Error('renderSetup() must be implemented');
  }
  
  /**
   * Отримати налаштування від користувача
   * @returns {Object} об'єкт з налаштуваннями
   */
  getSetupConfig() {
    throw new Error('getSetupConfig() must be implemented');
  }
  
  /**
   * Рендер інтерфейсу тестування
   * @param {HTMLElement} container - контейнер для рендерингу
   */
  renderQuizInterface(container) {
    throw new Error('renderQuizInterface() must be implemented');
  }
  
  /**
   * Показати питання
   * @param {Object} question - питання для відображення
   * @param {number} index - індекс питання (0-based)
   */
  showQuestion(question, index) {
    throw new Error('showQuestion() must be implemented');
  }
  
  /**
   * Перевірити відповідь користувача
   * @param {Object} question - питання
   * @param {any} userAnswer - відповідь користувача
   * @returns {boolean} true якщо правильно
   */
  checkAnswer(question, userAnswer) {
    throw new Error('checkAnswer() must be implemented');
  }
  
  /**
   * Показати коментар після відповіді
   * @param {Object} question - питання
   * @param {boolean} wasCorrect - чи була відповідь правильною
   */
  showComment(question, wasCorrect) {
    // За замовчуванням показуємо comment якщо є
    if (question.comment) {
      const commentEl = document.getElementById('answerComment');
      if (commentEl) {
        commentEl.innerHTML = `
          <div class="comment-icon">${wasCorrect ? '✅' : '❌'}</div>
          <div class="comment-text">${question.comment}</div>
        `;
        commentEl.style.display = 'block';
      }
    }
  }
  
  /**
   * Рендер екрану результатів
   * @param {HTMLElement} container - контейнер для рендерингу
   * @param {Object} results - об'єкт з результатами тесту
   */
  renderResults(container, results) {
    throw new Error('renderResults() must be implemented');
  }
  
  // ==================== HELPER МЕТОДИ ====================
  
  /**
   * Очистити контейнер
   * @param {HTMLElement} container
   */
  clearContainer(container) {
    container.innerHTML = '';
  }
  
  /**
   * Показати повідомлення про помилку
   * @param {HTMLElement} container
   * @param {string} message
   */
  showError(container, message) {
    container.innerHTML = `
      <div class="error-message">
        <div class="error-icon">⚠️</div>
        <div class="error-text">${message}</div>
      </div>
    `;
  }
}
