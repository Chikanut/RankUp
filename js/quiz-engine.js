/**
 * QuizForge - Quiz Engine
 * Двигун тестування
 */

import CONFIG from './config.js';
import StorageManager from './storage.js';

class QuizEngine {
    constructor() {
        this.testId = null;
        this.testData = null;
        this.currentQuestionIndex = 0;
        this.answers = [];
        this.startTime = null;
        
        this.init();
    }

    async init() {
        // Отримати ID тесту з URL
        const urlParams = new URLSearchParams(window.location.search);
        this.testId = urlParams.get('test');

        if (!this.testId) {
            this.showError('Тест не знайдено');
            return;
        }

        try {
            await this.loadTest();
            this.startTest();
        } catch (error) {
            console.error('Помилка:', error);
            this.showError('Не вдалося завантажити тест');
        }
    }

    /**
     * Завантажити дані тесту
     */
    async loadTest() {
        // TODO: Завантажити реальний JSON файл
        // Поки що створюємо демо-тест
        this.testData = {
            id: this.testId,
            title: 'Демонстраційний тест',
            questions: this.createDemoQuestions()
        };

        console.log('✅ Тест завантажено:', this.testData.title);
    }

    /**
     * Створити демо-питання
     */
    createDemoQuestions() {
        return [
            {
                id: 'q1',
                type: 'multiple-choice',
                question: 'Скільки буде 2 + 2?',
                answers: [
                    { text: '3', isCorrect: false },
                    { text: '4', isCorrect: true },
                    { text: '5', isCorrect: false },
                    { text: '22', isCorrect: false }
                ]
            },
            {
                id: 'q2',
                type: 'multiple-choice',
                question: 'Яка столиця України?',
                answers: [
                    { text: 'Львів', isCorrect: false },
                    { text: 'Київ', isCorrect: true },
                    { text: 'Одеса', isCorrect: false },
                    { text: 'Харків', isCorrect: false }
                ]
            }
        ];
    }

    /**
     * Почати тест
     */
    startTest() {
        this.startTime = Date.now();
        this.answers = new Array(this.testData.questions.length).fill(null);
        this.showQuestion(0);
        this.setupControls();
    }

    /**
     * Показати питання
     */
    showQuestion(index) {
        this.currentQuestionIndex = index;
        const question = this.testData.questions[index];
        
        // Оновити прогрес
        this.updateProgress();
        
        // Відрендерити питання
        const container = document.getElementById('quiz-container');
        container.innerHTML = this.renderQuestion(question);
        
        // Додати обробники для відповідей
        this.setupAnswerHandlers();
    }

    /**
     * Рендер питання
     */
    renderQuestion(question) {
        if (question.type === 'multiple-choice') {
            return `
                <div class="question-container">
                    <h2 class="question-text">${question.question}</h2>
                    <div class="answers-list">
                        ${question.answers.map((answer, index) => `
                            <div class="answer-option" data-answer-index="${index}">
                                <span class="answer-letter">${String.fromCharCode(65 + index)}</span>
                                <span class="answer-text">${answer.text}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        return '<p>Тип питання не підтримується</p>';
    }

    /**
     * Налаштувати обробники відповідей
     */
    setupAnswerHandlers() {
        const options = document.querySelectorAll('.answer-option');
        
        options.forEach((option, index) => {
            option.addEventListener('click', () => {
                // Зняти попередній вибір
                options.forEach(opt => opt.classList.remove('selected'));
                
                // Встановити новий вибір
                option.classList.add('selected');
                
                // Зберегти відповідь
                this.answers[this.currentQuestionIndex] = index;
                
                // Активувати кнопку "Далі"
                document.getElementById('next-btn').disabled = false;
            });
        });
    }

    /**
     * Оновити прогрес
     */
    updateProgress() {
        const current = this.currentQuestionIndex + 1;
        const total = this.testData.questions.length;
        const percentage = (current / total) * 100;
        
        document.getElementById('current-question').textContent = current;
        document.getElementById('total-questions').textContent = total;
        document.getElementById('progress-fill').style.width = percentage + '%';
    }

    /**
     * Налаштувати контроли
     */
    setupControls() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const quitBtn = document.getElementById('quit-btn');
        const controls = document.getElementById('quiz-controls');
        
        controls.style.display = 'flex';
        
        prevBtn.addEventListener('click', () => this.prevQuestion());
        nextBtn.addEventListener('click', () => this.nextQuestion());
        quitBtn.addEventListener('click', () => this.quitQuiz());
    }

    /**
     * Попереднє питання
     */
    prevQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.showQuestion(this.currentQuestionIndex - 1);
        }
    }

    /**
     * Наступне питання
     */
    nextQuestion() {
        if (this.currentQuestionIndex < this.testData.questions.length - 1) {
            this.showQuestion(this.currentQuestionIndex + 1);
        } else {
            this.finishQuiz();
        }
    }

    /**
     * Завершити тест
     */
    finishQuiz() {
        const endTime = Date.now();
        const timeSpent = Math.round((endTime - this.startTime) / 1000);
        
        // Підрахувати результати
        let correctCount = 0;
        this.testData.questions.forEach((question, index) => {
            const userAnswer = this.answers[index];
            if (userAnswer !== null && question.answers[userAnswer].isCorrect) {
                correctCount++;
            }
        });
        
        const result = {
            testId: this.testId,
            correctCount,
            totalQuestions: this.testData.questions.length,
            percentage: Math.round((correctCount / this.testData.questions.length) * 100),
            timeSpent
        };
        
        // Зберегти результат
        StorageManager.saveTestResult(this.testId, result);
        
        // Показати результати
        this.showResults(result);
    }

    /**
     * Показати результати
     */
    showResults(result) {
        const modal = document.getElementById('results-modal');
        const content = document.getElementById('results-content');
        
        content.innerHTML = `
            <div class="results-stats">
                <div class="result-score ${result.percentage >= 70 ? 'pass' : 'fail'}">
                    ${result.percentage}%
                </div>
                <p>Правильних відповідей: ${result.correctCount} з ${result.totalQuestions}</p>
                <p>Витрачено часу: ${Math.floor(result.timeSpent / 60)} хв ${result.timeSpent % 60} сек</p>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        // Кнопки
        document.getElementById('retry-btn').addEventListener('click', () => location.reload());
        document.getElementById('home-btn').addEventListener('click', () => location.href = 'index.html');
    }

    /**
     * Вийти з тесту
     */
    quitQuiz() {
        if (confirm('Ви впевнені, що хочете вийти? Прогрес не буде збережено.')) {
            location.href = 'index.html';
        }
    }

    /**
     * Показати помилку
     */
    showError(message) {
        const container = document.getElementById('quiz-container');
        container.innerHTML = `
            <div class="error-message">
                <h2>❌ Помилка</h2>
                <p>${message}</p>
                <a href="index.html" class="btn-start">← Повернутись на головну</a>
            </div>
        `;
    }
}

// Ініціалізувати при завантаженні
document.addEventListener('DOMContentLoaded', () => {
    new QuizEngine();
});