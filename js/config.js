/**
 * QuizForge - Configuration
 * Центральні налаштування додатку
 */

export const CONFIG = {
    // Шляхи до файлів
    PATHS: {
        TESTS_INDEX: 'data/tests-index.json',
        DATA_DIR: 'data/'
    },

    // LocalStorage ключі
    STORAGE_KEYS: {
        HISTORY: (testId) => `quizforge_${testId}_history`,
        STATS: (testId) => `quizforge_${testId}_stats`,
        SETTINGS: 'quizforge_global_settings',
        LAST_TEST: 'quizforge_last_test'
    },

    // Налаштування тестування
    QUIZ: {
        QUESTIONS_PER_SESSION: 25, // За замовчуванням
        SHUFFLE_QUESTIONS: true,
        SHUFFLE_ANSWERS: true,
        SHOW_CORRECT_ANSWER: true
    },

    // UI налаштування
    UI: {
        ANIMATION_DURATION: 300,
        TOAST_DURATION: 3000
    },

    // Версія додатку
    VERSION: '0.2.0'
};

export default CONFIG;