# 🎯 QuizForge v0.3.0

**Модульна платформа інтерактивного навчання через тестування**

---

## 📋 Опис проекту

QuizForge - це сучасна веб-платформа для проходження навчальних тестів з підтримкою різних режимів тестування, детальною аналітикою та повністю офлайн роботою.

### ✨ Ключові особливості

- **Модульна архітектура** - легко додавати нові режими тестування та тести
- **Плагінна система** - кожен режим тестування є окремим модулем
- **Динамічна валідація** - автоматичне визначення підтримуваних режимів для кожного тесту
- **Офлайн-first** - працює без інтернету, дані зберігаються локально
- **Адаптивний дизайн** - працює на всіх пристроях
- **Детальна аналітика** - історія проходжень, статистика помилок

---

## 🚀 Швидкий старт

### Локальна розробка

1. Клонуйте репозиторій
2. Запустіть локальний сервер (необхідно для ES6 Modules):

```bash
# Python 3
python3 -m http.server 8000

# Node.js (якщо встановлено http-server)
npx http-server -p 8000

# VS Code Live Server
# Просто відкрийте index.html та натисніть "Go Live"
```

3. Відкрийте браузер: `http://localhost:8000`

### Deployment на GitHub Pages

1. Push код в репозиторій GitHub
2. Налаштуйте GitHub Pages (Settings → Pages → Source: main branch)
3. Ваш сайт буде доступний за адресою: `https://username.github.io/repository-name/`

---

## 📁 Структура проекту

```
quizforge/
├── index.html              # Каталог тестів
├── quiz.html               # Сторінка тестування (SPA)
│
├── css/
│   └── style.css          # Єдиний файл стилів
│
├── js/
│   ├── quiz-controller.js # Головний контролер
│   └── plugins/           # Плагіни режимів тестування
│       ├── base-plugin.js
│       ├── registry.js
│       └── multiple-choice.js
│
└── data/
    ├── tests.json         # Master конфігурація
    └── tests/             # Файли з тестами
        └── leadership-course.json
```

---

## 🔌 Плагінна система

### Поточні режими

- ✅ **Multiple Choice** (Вибір з варіантів) - готовий
- ⏳ **Flashcards** (Картки запам'ятовування) - заплановано
- ⏳ **True/False** (Правда/Неправда) - заплановано
- ⏳ **Fill in the Blank** (Заповни пропуск) - заплановано

### Як додати новий режим

1. Створіть файл `js/plugins/my-mode.js`
2. Розширте `BasePlugin`:

```javascript
import BasePlugin from './base-plugin.js';

export default class MyModePlugin extends BasePlugin {
  static get metadata() {
    return {
      id: 'my-mode',
      name: 'Моя назва',
      icon: '🎮',
      description: 'Опис режиму'
    };
  }
  
  static supportsQuestion(question) {
    // Логіка валідації питання
    return question.myField !== undefined;
  }
  
  // Реалізуйте інші методи...
}
```

3. Зареєструйте в `js/plugins/registry.js`:

```javascript
import MyModePlugin from './my-mode.js';
this.register(MyModePlugin);
```

4. Увімкніть в `data/tests.json`:

```json
{
  "plugins": {
    "my-mode": {
      "enabled": true,
      "name": "Моя назва",
      "icon": "🎮"
    }
  }
}
```

---

## 📝 Формат даних тесту

### Структура JSON файлу

```json
{
  "meta": {
    "id": "test-id",
    "title": "Назва тесту",
    "description": "Опис",
    "version": "1.0",
    "totalQuestions": 100,
    "categories": ["Категорія 1", "Категорія 2"]
  },
  "questions": [
    {
      "id": 1,
      "category": "Категорія 1",
      "difficulty": 1,
      "question": "Текст питання?",
      "comment": "Пояснення відповіді",
      
      // Поля для Multiple Choice
      "answers": [
        { "text": "Варіант А", "isCorrect": true },
        { "text": "Варіант Б", "isCorrect": false }
      ]
    }
  ]
}
```

### Валідація плагіном

Плагін автоматично перевіряє наявність необхідних полів:
- Multiple Choice потребує: `answers` (масив з 2+ елементів, де є `isCorrect: true`)
- Flashcards потребує: `flashcardHint` або `answers`
- True/False потребує: `answers` (точно 2 елементи)

---

## ⚙️ Конфігурація

### data/tests.json (Master Config)

```json
{
  "version": "0.3.0",
  
  "plugins": {
    "multiple-choice": {
      "enabled": true
    },
    "flashcards": {
      "enabled": false
    }
  },
  
  "tests": [
    {
      "id": "test-id",
      "title": "Назва",
      "dataFile": "data/tests/test-id.json",
      "enabled": true
    }
  ]
}
```

### Як додати новий тест

1. Створіть JSON файл: `data/tests/my-test.json`
2. Додайте запис в `data/tests.json`:

```json
{
  "id": "my-test",
  "title": "Мій тест",
  "description": "Опис тесту",
  "icon": "📚",
  "category": "education",
  "dataFile": "data/tests/my-test.json",
  "totalQuestions": 50,
  "estimatedTime": "25 хв",
  "difficulty": "medium",
  "tags": ["математика", "алгебра"],
  "enabled": true
}
```

3. Тест автоматично з'явиться на головній сторінці!

---

## 💾 Зберігання даних

### LocalStorage структура

```
quizforge_{testId}_history     - історія проходжень
quizforge_{testId}_stats       - статистика по питаннях
```

### Експорт/Імпорт

Функції експорту та імпорту даних будуть додані в наступних версіях.

---

## 🎨 Кастомізація

### Зміна кольорової схеми

Відредагуйте CSS змінні в `css/style.css`:

```css
:root {
  --accent-blue: #3b82f6;      /* Основний акцентний колір */
  --accent-green: #10b981;     /* Успіх */
  --accent-red: #ef4444;       /* Помилка */
  --bg-primary: #071428;       /* Фон */
  --text-primary: #e6eef8;     /* Текст */
}
```

---

## 🐛 Відомі обмеження

1. **LocalStorage ліміт** - 5-10MB залежно від браузера
2. **ES6 Modules** - вимагає сучасний браузер (Chrome 61+, Firefox 60+, Safari 11+)
3. **Без синхронізації** - дані не синхронізуються між пристроями
4. **CORS** - потрібен локальний сервер для розробки

---

## 🔮 Roadmap

### v0.4.0 (Планується)
- [ ] Плагін Flashcards
- [ ] Плагін True/False
- [ ] Розширена статистика з графіками
- [ ] Експорт результатів у PDF/JSON

### v0.5.0 (Майбутнє)
- [ ] PWA функціонал (офлайн кешування)
- [ ] Система досягнень (badges)
- [ ] Додаткові тести
- [ ] Темна/світла тема

---

## 📄 Ліцензія

MIT License

---

## 👨‍💻 Розробник

**СІГСПП молодший сержант Войтович Євген**

**Версія:** 0.3.0  
**Дата:** 18 жовтня 2025

---

## 🙏 Подяки

- Claude AI (Anthropic) - за допомогу в розробці архітектури
- Всім майбутнім контриб'юторам!

---

**⭐ Якщо проект корисний - поставте зірку на GitHub!**
