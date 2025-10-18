/**
 * QuizForge - Storage Manager
 * Керування LocalStorage
 */

import CONFIG from './config.js';

export class StorageManager {
    /**
     * Зберегти результат тесту
     */
    static saveTestResult(testId, result) {
        const key = CONFIG.STORAGE_KEYS.HISTORY(testId);
        const history = this.getTestHistory(testId);
        
        history.push({
            date: new Date().toISOString(),
            score: result.score,
            correctCount: result.correctCount,
            totalQuestions: result.totalQuestions,
            timeSpent: result.timeSpent,
            percentage: Math.round((result.correctCount / result.totalQuestions) * 100)
        });

        localStorage.setItem(key, JSON.stringify(history));
    }

    /**
     * Отримати історію проходжень тесту
     */
    static getTestHistory(testId) {
        const key = CONFIG.STORAGE_KEYS.HISTORY(testId);
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    }

    /**
     * Зберегти статистику по питаннях
     */
    static saveQuestionStats(testId, questionId, isCorrect) {
        const key = CONFIG.STORAGE_KEYS.STATS(testId);
        const stats = this.getQuestionStats(testId);

        if (!stats[questionId]) {
            stats[questionId] = {
                attempts: 0,
                correct: 0,
                incorrect: 0
            };
        }

        stats[questionId].attempts++;
        if (isCorrect) {
            stats[questionId].correct++;
        } else {
            stats[questionId].incorrect++;
        }

        localStorage.setItem(key, JSON.stringify(stats));
    }

    /**
     * Отримати статистику по питаннях
     */
    static getQuestionStats(testId) {
        const key = CONFIG.STORAGE_KEYS.STATS(testId);
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : {};
    }

    /**
     * Очистити всі дані
     */
    static clearAllData() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('quizforge_')) {
                localStorage.removeItem(key);
            }
        });
    }

    /**
     * Експорт даних
     */
    static exportData() {
        const data = {};
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith('quizforge_')) {
                data[key] = JSON.parse(localStorage.getItem(key));
            }
        });

        return JSON.stringify(data, null, 2);
    }
}

export default StorageManager;