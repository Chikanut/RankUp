/**
 * QuizForge - Main Application
 * Головна логіка index.html
 */

import CONFIG from './config.js';
import Analytics from './analytics.js';

class QuizForgeApp {
    constructor() {
        this.tests = [];
        this.filteredTests = [];
        this.init();
    }

    async init() {
        console.log('🚀 QuizForge v' + CONFIG.VERSION);
        
        try {
            await this.loadTests();
            this.renderTests();
            this.setupEventListeners();
        } catch (error) {
            console.error('Помилка ініціалізації:', error);
            this.showError('Не вдалося завантажити тести. Перевірте підключення.');
        }
    }

    /**
     * Завантажити список тестів
     */
    async loadTests() {
        try {
            const response = await fetch(CONFIG.PATHS.TESTS_INDEX);
            if (!response.ok) throw new Error('Не вдалося завантажити тести');
            
            const data = await response.json();
            this.tests = data.tests || [];
            this.filteredTests = [...this.tests];
            
            console.log(`✅ Завантажено ${this.tests.length} тестів`);
        } catch (error) {
            console.error('Помилка завантаження тестів:', error);
            
            // Fallback: створюємо тестовий набір
            this.tests = this.createDemoTests();
            this.filteredTests = [...this.tests];
        }
    }

    /**
     * Створити демо-тести (якщо JSON не завантажився)
     */
    createDemoTests() {
        return [
            {
                id: 'demo-test',
                title: 'Демонстраційний тест',
                description: 'Тестовий набір питань для перевірки роботи системи',
                icon: '🎯',
                category: 'demo',
                totalQuestions: 10,
                estimatedTime: '5 хв',
                difficulty: 'easy'
            }
        ];
    }

    /**
     * Відрендерити тести
     */
    renderTests() {
        const catalog = document.getElementById('tests-catalog');
        
        if (this.filteredTests.length === 0) {
            catalog.innerHTML = `
                <div class="loading">
                    Тестів не знайдено. Спробуйте інші фільтри.
                </div>
            `;
            return;
        }

        catalog.innerHTML = this.filteredTests.map(test => this.createTestCard(test)).join('');
    }

    /**
     * Створити картку тесту
     */
    createTestCard(test) {
        const stats = Analytics.getTestStats(test.id);
        const statsHTML = stats ? `
            <div class="test-stats">
                <span>📊 Спроб: ${stats.attempts}</span>
                <span>🏆 Найкраще: ${stats.bestScore}%</span>
            </div>
        ` : '';

        return `
            <div class="test-card" data-test-id="${test.id}">
                <div class="test-icon">${test.icon || '📝'}</div>
                <h2>${test.title}</h2>
                <p>${test.description}</p>
                <div class="test-meta">
                    <span>📊 ${test.totalQuestions} питань</span>
                    <span>⏱️ ${test.estimatedTime}</span>
                    <span class="difficulty-badge difficulty-${test.difficulty}">
                        ${this.getDifficultyLabel(test.difficulty)}
                    </span>
                </div>
                ${statsHTML}
                <a href="quiz.html?test=${test.id}" class="btn-start">
                    Почати тест →
                </a>
            </div>
        `;
    }

    /**
     * Отримати мітку складності
     */
    getDifficultyLabel(difficulty) {
        const labels = {
            easy: 'Легкий',
            medium: 'Середній',
            hard: 'Складний'
        };
        return labels[difficulty] || 'Середній';
    }

    /**
     * Налаштувати обробники подій
     */
    setupEventListeners() {
        // Пошук
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Фільтри
        const categoryFilter = document.getElementById('category-filter');
        const difficultyFilter = document.getElementById('difficulty-filter');
        
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.applyFilters());
        }
        
        if (difficultyFilter) {
            difficultyFilter.addEventListener('change', () => this.applyFilters());
        }

        // Кнопки навігації
        const statsBtn = document.getElementById('stats-btn');
        const settingsBtn = document.getElementById('settings-btn');
        
        if (statsBtn) {
            statsBtn.addEventListener('click', () => this.showStats());
        }
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }
    }

    /**
     * Обробка пошуку
     */
    handleSearch(query) {
        const lowercaseQuery = query.toLowerCase();
        
        this.filteredTests = this.tests.filter(test => 
            test.title.toLowerCase().includes(lowercaseQuery) ||
            test.description.toLowerCase().includes(lowercaseQuery)
        );
        
        this.renderTests();
    }

    /**
     * Застосувати фільтри
     */
    applyFilters() {
        const category = document.getElementById('category-filter')?.value;
        const difficulty = document.getElementById('difficulty-filter')?.value;
        
        this.filteredTests = this.tests.filter(test => {
            const categoryMatch = !category || category === 'all' || test.category === category;
            const difficultyMatch = !difficulty || difficulty === 'all' || test.difficulty === difficulty;
            return categoryMatch && difficultyMatch;
        });
        
        this.renderTests();
    }

    /**
     * Показати статистику
     */
    showStats() {
        alert('Статистика буде реалізована в наступній версії! 📊');
        // TODO: Відкрити модальне вікно зі статистикою
    }

    /**
     * Показати налаштування
     */
    showSettings() {
        alert('Налаштування будуть доступні в наступній версії! ⚙️');
        // TODO: Відкрити модальне вікно з налаштуваннями
    }

    /**
     * Показати помилку
     */
    showError(message) {
        const catalog = document.getElementById('tests-catalog');
        catalog.innerHTML = `
            <div class="loading" style="color: var(--accent-red);">
                ❌ ${message}
            </div>
        `;
    }
}

// Ініціалізувати додаток при завантаженні сторінки
document.addEventListener('DOMContentLoaded', () => {
    new QuizForgeApp();
});