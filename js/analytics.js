/**
 * QuizForge - Analytics Module
 * Аналітика та візуалізація
 */

import StorageManager from './storage.js';

export class Analytics {
    /**
     * Отримати загальну статистику
     */
    static getOverallStats() {
        // TODO: Реалізувати в наступних версіях
        return {
            totalTests: 0,
            totalAttempts: 0,
            averageScore: 0
        };
    }

    /**
     * Отримати статистику конкретного тесту
     */
    static getTestStats(testId) {
        const history = StorageManager.getTestHistory(testId);
        
        if (history.length === 0) {
            return null;
        }

        const scores = history.map(h => h.percentage);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const bestScore = Math.max(...scores);
        const lastScore = scores[scores.length - 1];

        return {
            attempts: history.length,
            averageScore: Math.round(avgScore),
            bestScore,
            lastScore,
            lastAttempt: history[history.length - 1].date
        };
    }

    /**
     * Отримати найскладніші питання
     */
    static getHardestQuestions(testId, limit = 5) {
        const stats = StorageManager.getQuestionStats(testId);
        
        const questions = Object.entries(stats)
            .map(([id, data]) => ({
                id,
                errorRate: data.attempts > 0 ? (data.incorrect / data.attempts) * 100 : 0,
                attempts: data.attempts
            }))
            .filter(q => q.attempts > 0)
            .sort((a, b) => b.errorRate - a.errorRate)
            .slice(0, limit);

        return questions;
    }
}

export default Analytics;