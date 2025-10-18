/**
 * QuizController - головний контролер для керування процесом тестування
 * Керує екранами: mode-select → setup → quiz → results
 */

import pluginRegistry from './plugins/registry.js';

class QuizController {
  constructor() {
    this.masterConfig = null;
    this.testData = null;
    this.testId = null;
    this.supportedPlugins = [];
    this.currentPlugin = null;
    this.currentScreen = null;
  }
  
  /**
   * Ініціалізація контролера
   */
  async initialize() {
    console.log('🚀 Initializing Quiz Controller...');
    
    // Отримати testId з URL
    const urlParams = new URLSearchParams(window.location.search);
    this.testId = urlParams.get('test');
    
    if (!this.testId) {
      this.showError('Не вказано ID тесту. Параметр ?test=... відсутній');
      return;
    }
    
    console.log(`📝 Test ID: ${this.testId}`);
    
    try {
      // 1. Завантажити master config
      await this.loadMasterConfig();
      
      // 2. Ініціалізувати реєстр плагінів
      await pluginRegistry.initialize(this.masterConfig);
      
      // 3. Завантажити дані тесту
      await this.loadTestData();
      
      // 4. Знайти підтримувані плагіни
      this.supportedPlugins = pluginRegistry.getSupportedPlugins(this.testData);
      
      // 5. Показати вибір режиму (або автоматично обрати якщо тільки один)
      this.showModeSelection();
      
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      this.showError(`Помилка ініціалізації: ${error.message}`);
    }
  }
  
  /**
   * Завантажити master config
   */
  async loadMasterConfig() {
    console.log('📥 Loading master config...');
    
    const response = await fetch('data/tests.json');
    if (!response.ok) {
      throw new Error('Не вдалось завантажити конфігурацію тестів');
    }
    
    this.masterConfig = await response.json();
    console.log(`✅ Loaded config v${this.masterConfig.version}`);
  }
  
  /**
   * Завантажити дані тесту
   */
  async loadTestData() {
    console.log(`📥 Loading test data for: ${this.testId}`);
    
    // Знайти тест в конфігу
    const testConfig = this.masterConfig.tests.find(t => t.id === this.testId);
    
    if (!testConfig) {
      throw new Error(`Тест "${this.testId}" не знайдено в конфігурації`);
    }
    
    if (!testConfig.enabled) {
      throw new Error(`Тест "${this.testId}" вимкнено`);
    }
    
    // Завантажити дані
    const response = await fetch(testConfig.dataFile);
    if (!response.ok) {
      throw new Error(`Не вдалось завантажити дані тесту: ${testConfig.dataFile}`);
    }
    
    this.testData = await response.json();
    console.log(`✅ Loaded ${this.testData.questions.length} questions`);
  }
  
  /**
   * Показати екран вибору режиму
   */
  showModeSelection() {
    console.log('🎮 Showing mode selection...');
    
    // Якщо немає підтримуваних режимів
    if (this.supportedPlugins.length === 0) {
      this.showScreen('mode-select');
      const container = document.getElementById('mode-select');
      container.innerHTML = `
        <div class="error-screen">
          <div class="error-icon">❌</div>
          <h2>Немає підтримуваних режимів</h2>
          <p>Цей тест не підтримує жоден з доступних режимів тестування.</p>
          <p class="muted">Тест: ${this.testData.meta.title}</p>
          <button class="btn-primary" onclick="window.location.href='index.html'">
            ← Повернутись до списку тестів
          </button>
        </div>
      `;
      return;
    }
    
    // Якщо тільки один режим - автоматично обрати
    if (this.supportedPlugins.length === 1) {
      console.log('ℹ️  Only one mode available, auto-selecting...');
      this.selectMode(this.supportedPlugins[0]);
      return;
    }
    
    // Показати вибір режиму
    this.showScreen('mode-select');
    this.renderModeSelection();
  }
  
  /**
   * Рендер екрану вибору режиму
   */
  renderModeSelection() {
    const container = document.getElementById('mode-select');
    
    container.innerHTML = `
      <div class="mode-select-container">
        <div class="mode-header">
          <button class="btn-back" onclick="window.location.href='index.html'">
            ← Назад
          </button>
          <div>
            <h1>Оберіть режим тестування</h1>
            <p class="muted">${this.testData.meta.title}</p>
          </div>
        </div>
        
        <div class="mode-grid">
          ${this.supportedPlugins.map((item, index) => `
            <div class="mode-card" data-index="${index}">
              <div class="mode-icon">${item.metadata.icon}</div>
              <h3>${item.metadata.name}</h3>
              <p class="mode-description">${item.metadata.description}</p>
              <div class="mode-stats">
                <span class="badge">
                  ${item.validation.supportedCount} / ${item.validation.totalCount} питань
                </span>
                ${item.validation.percentage ? `
                  <span class="badge badge-accent">
                    ${item.validation.percentage}%
                  </span>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    // Додати обробники
    container.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.dataset.index);
        this.selectMode(this.supportedPlugins[index]);
      });
    });
  }
  
  /**
   * Вибрати режим тестування
   */
  selectMode(pluginItem) {
    console.log(`✅ Selected mode: ${pluginItem.metadata.name}`);
    
    // Створити екземпляр плагіна
    this.currentPlugin = new pluginItem.pluginClass();
    
    // Фільтрувати тільки підтримувані питання
    const filteredQuestions = pluginItem.pluginClass.filterQuestions(this.testData.questions);
    
    console.log(`📝 Filtered ${filteredQuestions.length} supported questions`);
    
    // Показати екран налаштувань
    this.showScreen('setup');
    this.currentPlugin.renderSetup(
      document.getElementById('setup'),
      this.testData,
      filteredQuestions
    );
  }
  
  /**
   * Показати певний екран (приховати всі інші)
   */
  showScreen(screenId) {
    console.log(`🖥️  Showing screen: ${screenId}`);
    
    const screens = ['mode-select', 'setup', 'quiz', 'results'];
    
    screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.toggle('active', id === screenId);
      }
    });
    
    this.currentScreen = screenId;
  }
  
  /**
   * Зберегти результати тесту
   */
  saveResults(results) {
    console.log('💾 Saving results...', results);
    
    // Отримати існуючу історію
    const storageKey = `quizforge_${this.testId}_history`;
    let history = [];
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        history = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load history:', e);
    }
    
    // Додати новий результат
    const resultEntry = {
      date: new Date().toISOString(),
      mode: this.currentPlugin.constructor.metadata.id,
      score: results.correctCount,
      total: results.totalQuestions,
      percentage: results.percentage,
      timeSpent: results.timeSpent,
      mistakesCount: results.mistakesCount
    };
    
    history.push(resultEntry);
    
    // Зберегти (лімітувати до останніх 50 записів)
    if (history.length > 50) {
      history = history.slice(-50);
    }
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(history));
      console.log('✅ Results saved');
    } catch (e) {
      console.error('❌ Failed to save results:', e);
    }
    
    // Зберегти статистику по питаннях
    this.saveQuestionStats(results);
  }
  
  /**
   * Зберегти статистику по питаннях
   */
  saveQuestionStats(results) {
    const storageKey = `quizforge_${this.testId}_stats`;
    let stats = {};
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        stats = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
    
    // Оновити статистику
    results.questions.forEach((question, index) => {
      const answer = results.userAnswers[index];
      if (!answer) return;
      
      if (!stats[question.id]) {
        stats[question.id] = {
          attempts: 0,
          correct: 0,
          incorrect: 0
        };
      }
      
      stats[question.id].attempts++;
      if (answer.isCorrect) {
        stats[question.id].correct++;
      } else {
        stats[question.id].incorrect++;
      }
    });
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(stats));
      console.log('✅ Question stats saved');
    } catch (e) {
      console.error('❌ Failed to save stats:', e);
    }
  }
  
  /**
   * Показати помилку
   */
  showError(message) {
    console.error('❌ Error:', message);
    
    document.body.innerHTML = `
      <div class="app">
        <div class="error-screen">
          <div class="error-icon">⚠️</div>
          <h1>Помилка</h1>
          <p>${message}</p>
          <button class="btn-primary" onclick="window.location.href='index.html'">
            ← Повернутись на головну
          </button>
        </div>
      </div>
    `;
  }
}

// Створити глобальний екземпляр
const quizController = new QuizController();

// Зробити доступним глобально
window.quizController = quizController;

export default quizController;
