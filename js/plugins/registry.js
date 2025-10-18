/**
 * PluginRegistry - центральний реєстр всіх плагінів режимів тестування
 */

import MultipleChoicePlugin from './multiple-choice.js';
import FlashcardPlugin from './flashcard.js';
import TrueFalsePlugin from './true-false.js';
import MatchingPlugin from './matching-plugin.js';

class PluginRegistry {
  constructor() {
    this.plugins = new Map();
    this.config = null;
  }
  
  /**
   * Ініціалізувати реєстр з конфігурацією
   * @param {Object} config - конфігурація з tests.json
   */
  async initialize(config) {
    this.config = config;
    console.log('🔌 Initializing Plugin Registry...');
    
    // Зареєструвати доступні плагіни
    this.register(MultipleChoicePlugin);
    this.register(FlashcardPlugin);
    this.register(TrueFalsePlugin);
    this.register(MatchingPlugin);
    
    console.log(`✅ Registered ${this.plugins.size} plugins`);
  }
  
  /**
   * Зареєструвати плагін
   * @param {Class} PluginClass - клас плагіна
   */
  register(PluginClass) {
    const metadata = PluginClass.metadata;
    
    if (!metadata || !metadata.id) {
      console.error('❌ Plugin must have metadata with id', PluginClass);
      return;
    }
    
    // Перевірити чи плагін увімкнено в конфігу
    const pluginConfig = this.config?.plugins?.[metadata.id];
    
    if (pluginConfig && pluginConfig.enabled === false) {
      console.log(`⏸️  Plugin ${metadata.id} is disabled in config`);
      return;
    }
    
    this.plugins.set(metadata.id, PluginClass);
    console.log(`  ✓ ${metadata.icon} ${metadata.name} (${metadata.id})`);
  }
  
  /**
   * Отримати всі зареєстровані плагіни
   * @returns {Array<Class>} масив класів плагінів
   */
  getAll() {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Отримати плагін за ID
   * @param {string} id - ID плагіна
   * @returns {Class|null} клас плагіна або null
   */
  get(id) {
    return this.plugins.get(id) || null;
  }
  
  /**
   * Перевірити чи плагін зареєстрований
   * @param {string} id - ID плагіна
   * @returns {boolean}
   */
  has(id) {
    return this.plugins.has(id);
  }
  
  /**
   * Знайти підтримувані плагіни для тесту
   * @param {Object} testData - дані тесту
   * @returns {Array<Object>} масив об'єктів { pluginClass, metadata, validation }
   */
  getSupportedPlugins(testData) {
    const supported = [];
    
    console.log(`🔍 Validating plugins for test: ${testData.meta.title}`);
    
    for (const [id, PluginClass] of this.plugins) {
      const validation = PluginClass.validate(testData);
      
      if (validation.valid) {
        supported.push({
          pluginClass: PluginClass,
          metadata: PluginClass.metadata,
          validation: validation
        });
        
        console.log(`  ✅ ${PluginClass.metadata.icon} ${PluginClass.metadata.name}: ${validation.supportedCount}/${validation.totalCount} питань (${validation.percentage}%)`);
      } else {
        console.log(`  ❌ ${PluginClass.metadata.icon} ${PluginClass.metadata.name}: ${validation.reason}`);
      }
    }
    
    console.log(`✅ Found ${supported.length} supported mode(s)`);
    
    return supported;
  }
  
  /**
   * Отримати метадані всіх плагінів
   * @returns {Array<Object>} масив метаданих
   */
  getAllMetadata() {
    return Array.from(this.plugins.values()).map(PluginClass => PluginClass.metadata);
  }
  
  /**
   * Очистити реєстр
   */
  clear() {
    this.plugins.clear();
    this.config = null;
  }
}

// Створити та експортувати глобальний екземпляр
const pluginRegistry = new PluginRegistry();

export default pluginRegistry;
