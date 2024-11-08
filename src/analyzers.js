const natural = require('natural');
const PorterStemmerRu = require('natural/lib/natural/stemmers/porter_stemmer_ru');
const stopWords = require('./stop-words');
const config = require('../chatreader.config');

class ContentAnalyzer {
    analyze(messages) {
        const stats = {
            codeBlocks: 0,
            lists: 0,
            textLength: 0
        };

        for (const msg of messages) {
            const content = msg?.content || '';
            stats.textLength += content.length;
            stats.codeBlocks += (content.match(/```[\s\S]*?```/g) || []).length;
            stats.lists += (content.match(/^[-*]\s/gm) || []).length;
        }

        return stats;
    }
}

class ContextAnalyzer {
    constructor() {
        this.techPatterns = {
            python: /python|django|flask|pip/i,
            javascript: /javascript|node|npm|react|vue|angular/i,
            css: /css|scss|sass|styling|flexbox|grid/i,
            database: /sql|mongodb|database|query/i,
            git: /git|commit|merge|branch/i,
            docker: /docker|container|image|kubernetes/i
        };

        this.categories = {
            coding: /функция|код|программирование|разработка|function|code|programming/i,
            architecture: /архитектура|дизайн|паттерн|структура|architecture|design|pattern/i,
            debugging: /отладка|ошибка|исключение|баг|debug|error|exception/i,
            optimization: /оптимизация|производительность|улучшение|optimize|performance/i,
            learning: /обучение|изучение|tutorial|learn|guide/i
        };
    }

    analyze(messages) {
        const context = {
            technologies: new Set(),
            categories: new Set()
        };

        const fullText = messages
            .map(m => m?.content || '')
            .filter(content => content.length > 0)
            .join(' ');

        for (const [tech, pattern] of Object.entries(this.techPatterns)) {
            if (pattern.test(fullText)) {
                context.technologies.add(tech);
            }
        }

        for (const [category, pattern] of Object.entries(this.categories)) {
            if (pattern.test(fullText)) {
                context.categories.add(category);
            }
        }

        return context;
    }
}

class TagExtractor {
    constructor() {
        this.tokenizer = new natural.WordTokenizer();
        this.stemmer = PorterStemmerRu;
        this.stopWords = new Set([
            ...stopWords.common,
            ...stopWords.technical
        ]);
    }

    extract(messages) {
        const text = messages
            .map(m => m?.content || '')
            .filter(content => content.length > 0)
            .join(' ');

        const tokens = this.tokenizer.tokenize(text);
        
        // Get stems and count frequencies
        const stems = {};
        tokens.forEach(token => {
            // Skip stop words, short tokens and undefined
            if (token && token.length > 3 && !this.stopWords.has(token.toLowerCase())) {
                const stem = this.stemmer.stem(token);
                if (stem) {
                    stems[stem] = (stems[stem] || 0) + 1;
                }
            }
        });

        // Sort by frequency and get top 10
        return Object.entries(stems)
            .sort(([,a], [,b]) => b - a)
            .slice(0, config.analysis.maxTerms)
            .map(([stem, count]) => ({ stem, count }));
    }

    // Add method to check if a word is a stop word
    isStopWord(word) {
        return this.stopWords.has(word.toLowerCase());
    }

    // Method to add new stop words
    addStopWords(words) {
        words.forEach(word => this.stopWords.add(word.toLowerCase()));
    }
}

class MetadataGenerator {
    constructor() {
        this.contentAnalyzer = new ContentAnalyzer();
        this.contextAnalyzer = new ContextAnalyzer();
        this.tagExtractor = new TagExtractor();
    }

    generate(conversation) {
        const content = this.contentAnalyzer.analyze(conversation.messages);
        const context = this.contextAnalyzer.analyze(conversation.messages);
        const terms = this.tagExtractor.extract(conversation.messages);

        return {
            content,
            context,
            terms,
            tags: this.generateTags(context, terms)
        };
    }

    generateTags(context, terms) {
        const tags = new Set();
        
        // Add technology tags
        context.technologies.forEach(tech => tags.add(`#${tech}`));
        
        // Add category tags
        context.categories.forEach(category => tags.add(`#${category}`));
        
        // Add term tags
        terms.forEach(({stem, count}) => tags.add(`#${stem}(${count})`));

        return Array.from(tags);
    }
}

module.exports = { MetadataGenerator }; 