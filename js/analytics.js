/**
 * Analytics - модуль для роботи зі статистикою тестів
 */

class Analytics {
  constructor() {
    this.storagePrefix = 'quizforge_';
  }
  
  /**
   * Отримати всі тести з історією
   * @returns {Array} масив об'єктів { testId, historyKey, statsKey, history, stats }
   */
  getAllTestsWithHistory() {
    const tests = [];
    
    // Перебрати всі ключі в LocalStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      // Шукаємо ключі з історією
      if (key.startsWith(this.storagePrefix) && key.endsWith('_history')) {
        const testId = key
          .replace(this.storagePrefix, '')
          .replace('_history', '');
        
        const historyKey = key;
        const statsKey = `${this.storagePrefix}${testId}_stats`;
        
        try {
          const history = JSON.parse(localStorage.getItem(historyKey)) || [];
          const stats = JSON.parse(localStorage.getItem(statsKey)) || {};
          
          if (history.length > 0) {
            tests.push({
              testId,
              historyKey,
              statsKey,
              history,
              stats
            });
          }
        } catch (e) {
          console.error(`Failed to parse data for ${testId}:`, e);
        }
      }
    }
    
    return tests;
  }
  
  /**
   * Отримати загальну статистику по всіх тестах
   * @returns {Object}
   */
  getGlobalStats() {
    const testsWithHistory = this.getAllTestsWithHistory();
    
    if (testsWithHistory.length === 0) {
      return {
        totalTests: 0,
        totalAttempts: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        totalTimeSpent: 0,
        averagePercentage: 0,
        testsWithHistory: []
      };
    }
    
    let totalAttempts = 0;
    let totalQuestions = 0;
    let totalCorrect = 0;
    let totalTimeSpent = 0;
    
    testsWithHistory.forEach(test => {
      test.history.forEach(attempt => {
        totalAttempts++;
        totalQuestions += attempt.total || attempt.totalQuestions || 0;
        totalCorrect += attempt.score || attempt.correctCount || 0;
        totalTimeSpent += attempt.timeSpent || 0;
      });
    });
    
    return {
      totalTests: testsWithHistory.length,
      totalAttempts,
      totalQuestions,
      totalCorrect,
      totalTimeSpent,
      averagePercentage: totalQuestions > 0 
        ? Math.round((totalCorrect / totalQuestions) * 100) 
        : 0,
      testsWithHistory
    };
  }
  
  /**
   * Отримати статистику конкретного тесту
   * @param {string} testId
   * @returns {Object}
   */
  getTestStats(testId) {
    const historyKey = `${this.storagePrefix}${testId}_history`;
    const statsKey = `${this.storagePrefix}${testId}_stats`;
    
    let history = [];
    let questionStats = {};
    
    try {
      history = JSON.parse(localStorage.getItem(historyKey)) || [];
      questionStats = JSON.parse(localStorage.getItem(statsKey)) || {};
    } catch (e) {
      console.error(`Failed to load stats for ${testId}:`, e);
    }
    
    if (history.length === 0) {
      return {
        testId,
        attempts: 0,
        history: [],
        questionStats: {},
        bestScore: 0,
        averageScore: 0,
        lastAttempt: null,
        improvement: 0
      };
    }
    
    // Сортувати історію за датою (найновіші спочатку)
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Розрахувати метрики
    const scores = history.map(h => h.percentage || 0);
    const bestScore = Math.max(...scores);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const lastAttempt = history[0];
    
    // Покращення (порівняння останньої спроби з першою)
    const improvement = history.length > 1 
      ? (history[0].percentage || 0) - (history[history.length - 1].percentage || 0)
      : 0;
    
    return {
      testId,
      attempts: history.length,
      history,
      questionStats,
      bestScore,
      averageScore,
      lastAttempt,
      improvement
    };
  }
  
  /**
   * Отримати найскладніші питання
   * @param {string} testId
   * @param {number} limit - кількість питань
   * @returns {Array}
   */
  getHardestQuestions(testId, limit = 10) {
    const stats = this.getTestStats(testId);
    
    if (Object.keys(stats.questionStats).length === 0) {
      return [];
    }
    
    // Конвертувати об'єкт у масив
    const questions = Object.entries(stats.questionStats).map(([id, data]) => ({
      questionId: parseInt(id),
      attempts: data.attempts,
      correct: data.correct,
      incorrect: data.incorrect,
      errorRate: data.attempts > 0 
        ? Math.round((data.incorrect / data.attempts) * 100)
        : 0
    }));
    
    // Сортувати за кількістю помилок (descending)
    questions.sort((a, b) => {
      // Спочатку за errorRate
      if (b.errorRate !== a.errorRate) {
        return b.errorRate - a.errorRate;
      }
      // Потім за кількістю спроб
      return b.attempts - a.attempts;
    });
    
    return questions.slice(0, limit);
  }
  
  /**
   * Очистити історію конкретного тесту
   * @param {string} testId
   */
  clearTestHistory(testId) {
    const historyKey = `${this.storagePrefix}${testId}_history`;
    const statsKey = `${this.storagePrefix}${testId}_stats`;
    
    localStorage.removeItem(historyKey);
    localStorage.removeItem(statsKey);
    
    console.log(`✅ History cleared for test: ${testId}`);
  }
  
  /**
   * Очистити всю історію
   */
  clearAllHistory() {
    const keys = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.storagePrefix)) {
        keys.push(key);
      }
    }
    
    keys.forEach(key => localStorage.removeItem(key));
    
    console.log(`✅ Cleared ${keys.length} items from storage`);
  }
  
  /**
   * Експортувати всю статистику у JSON
   * @returns {Object}
   */
  exportData() {
    const data = {
      version: '0.3.0',
      exportDate: new Date().toISOString(),
      tests: {}
    };
    
    const testsWithHistory = this.getAllTestsWithHistory();
    
    testsWithHistory.forEach(test => {
      data.tests[test.testId] = {
        history: test.history,
        stats: test.stats
      };
    });
    
    return data;
  }
  
  /**
   * Імпортувати статистику з JSON
   * @param {Object} data
   * @returns {boolean} success
   */
  importData(data) {
    try {
      if (!data.tests) {
        throw new Error('Invalid data format');
      }
      
      Object.entries(data.tests).forEach(([testId, testData]) => {
        const historyKey = `${this.storagePrefix}${testId}_history`;
        const statsKey = `${this.storagePrefix}${testId}_stats`;
        
        if (testData.history) {
          localStorage.setItem(historyKey, JSON.stringify(testData.history));
        }
        
        if (testData.stats) {
          localStorage.setItem(statsKey, JSON.stringify(testData.stats));
        }
      });
      
      console.log('✅ Data imported successfully');
      return true;
    } catch (e) {
      console.error('❌ Failed to import data:', e);
      return false;
    }
  }
  
  /**
   * Отримати розмір використаного LocalStorage
   * @returns {Object} { used: number (bytes), percentage: number }
   */
  getStorageSize() {
    let used = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.storagePrefix)) {
        const value = localStorage.getItem(key);
        used += key.length + (value ? value.length : 0);
      }
    }
    
    // LocalStorage ліміт зазвичай 5-10MB
    const limit = 5 * 1024 * 1024; // 5MB
    const percentage = Math.round((used / limit) * 100);
    
    return {
      used,
      usedKB: Math.round(used / 1024),
      usedMB: (used / (1024 * 1024)).toFixed(2),
      percentage,
      limit,
      limitMB: (limit / (1024 * 1024)).toFixed(0)
    };
  }
  
  /**
   * Згенерувати дані для графіка історії
   * @param {Array} history - історія проходжень
   * @returns {Object} { labels, data }
   */
  prepareChartData(history) {
    if (!history || history.length === 0) {
      return { labels: [], data: [] };
    }
    
    // Сортувати за датою (найстаріші спочатку для графіка)
    const sorted = [...history].sort((a, b) => 
      new Date(a.date) - new Date(b.date)
    );
    
    const labels = sorted.map((h, index) => {
      const date = new Date(h.date);
      return `${date.getDate()}.${date.getMonth() + 1}`;
    });
    
    const data = sorted.map(h => h.percentage || 0);
    
    return { labels, data };
  }
}

// Створити та експортувати глобальний екземпляр
const analytics = new Analytics();

export default analytics;
