const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { MetadataGenerator } = require('./analyzers');
const config = require('../chatreader.config');

class ChatProcessor {
    constructor() {
        this.metadataGenerator = new MetadataGenerator();
    }

    /**
     * Main method for processing all backups and saving the results
     */
    async processAllChats() {
        try {
            // Prepare directories
            await this.ensureDirectories();

            // Get and process all backups
            const backupFiles = await this.findBackupFiles();
            console.log(`Found ${backupFiles.length} backup files for analysis`);

            const allConversations = [];

            // Process each backup
            for (const file of backupFiles) {
                const conversations = await this.processBackupFile(file);
                allConversations.push(...conversations);
            }

            // Save all processed conversations to the target directory
            await this.saveConversations(allConversations);

            console.log('\nProcessing completed!');
            console.log(`Total conversations processed: ${allConversations.length}`);

        } catch (error) {
            console.error('Error processing chats:', error);
            throw error;
        }
    }

    /**
     * Ensure necessary directories exist
     */
    async ensureDirectories() {
        await fs.mkdir(config.directories.backup, { recursive: true });
        await fs.mkdir(config.directories.target, { recursive: true });
    }

    /**
     * Find backup files
     */
    async findBackupFiles() {
        const files = await fs.readdir(config.directories.backup);
        return files
            .filter(file => config.files.database.backupPattern.test(file))
            .map(file => path.join(config.directories.backup, file));
    }

    /**
     * Process a single backup file
     */
    async processBackupFile(backupPath) {
        // Try to extract date from filename (if backup files have timestamps in names)
        const filename = path.basename(backupPath);
        const dateMatch = filename.match(/\d{4}-\d{2}-\d{2}/);
        const backupDate = dateMatch 
            ? new Date(dateMatch[0])
            : new Date();

        return new Promise((resolve, reject) => {
            console.log(`\nProcessing backup: ${path.basename(backupPath)}`);
            
            const db = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, (err) => {
                if (err) reject(err);
            });

            const query = `
                SELECT key, value 
                FROM ItemTable 
                WHERE key LIKE '%chat%'
                   OR key LIKE '%conversation%'
                   OR key LIKE '%history%'
            `;

            db.all(query, async (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                try {
                    const conversations = [];
                    
                    for (const row of rows) {
                        try {
                            const parsedData = JSON.parse(row.value);
                            
                            if (parsedData.tabs) {
                                for (const tab of parsedData.tabs) {
                                    if (tab.bubbles && Array.isArray(tab.bubbles)) {
                                        conversations.push({
                                            title: tab.chatTitle || 'Untitled Chat',
                                            messages: tab.bubbles.map(bubble => ({
                                                role: bubble.type || 'unknown',
                                                content: bubble.text || '',
                                                timestamp: bubble.id
                                            }))
                                        });
                                    }
                                }
                            } else if (Array.isArray(parsedData)) {
                                const messages = parsedData.map(msg => ({
                                    role: msg.commandType === 2 ? 'system' : 
                                          msg.isUser ? 'user' : 'assistant',
                                    content: msg.text || '',
                                    timestamp: msg.timestamp || Date.now()
                                }));

                                if (messages.length > 0) {
                                    // Find the earliest message in the dialogue
                                    const timestamps = messages
                                        .map(msg => msg.timestamp)
                                        .filter(ts => ts && ts > 946684800000); // Filter incorrect dates (before 2000)

                                    const chatDate = timestamps.length > 0 
                                        ? new Date(Math.min(...timestamps))
                                        : new Date();

                                    conversations.push({
                                        title: `Chat-${config.templates.markdown.dateFormat(chatDate)}`,
                                        date: chatDate,
                                        messages
                                    });
                                }
                            }
                        } catch (parseError) {
                            console.warn(`Failed to parse data for key ${row.key}:`, parseError);
                        }
                    }

                    db.close();
                    resolve(conversations);
                } catch (error) {
                    reject(error);
                }
            });
        });
    }

    /**
     * Save processed conversations
     */
    async saveConversations(conversations) {
        let savedCount = 0;

        for (const conv of conversations) {
            if (!conv.messages?.length) continue;

            const metadata = this.metadataGenerator.generate(conv);
            const markdown = this.generateMarkdown(conv, metadata);
            
            if (!markdown) {
                console.log(`Skipping empty or short conversation: ${conv.title}`);
                continue;
            }

            const filename = `${config.templates.markdown.filename(conv.title)}.md`;
            const targetPath = path.join(config.directories.target, filename);

            try {
                await fs.writeFile(targetPath, markdown, 'utf8');
                savedCount++;
                console.log(`✓ Saved: ${filename}`);
            } catch (error) {
                console.error(`✗ Failed to save ${filename}:`, error.message);
            }
        }

        console.log(`\nSuccessfully saved ${savedCount} conversations`);
    }

    /**
     * Generate markdown content
     */
    generateMarkdown(conversation, metadata) {
        if (metadata.content.textLength < config.analysis.minTextLength) return null;

        let markdown = `# Conversation: ${conversation.title}\n\n`;
        
        markdown += `## Metadata\n`;
        markdown += `- Categories: ${Array.from(metadata.context.categories).join(', ') || 'not defined'}\n`;
        markdown += `- Content Statistics:\n`;
        markdown += `  - Code Blocks: ${metadata.content.codeBlocks}\n`;
        markdown += `  - Lists: ${metadata.content.lists}\n`;
        markdown += `  - Text Volume: ${metadata.content.textLength} characters\n\n`;

        markdown += `## Tags\n`;
        markdown += metadata.tags.length > 0 ? metadata.tags.join(' ') : '#untagged';
        markdown += '\n\n';

        markdown += `---\n\n`;
        for (const msg of conversation.messages) {
            if (!msg.content?.trim()) continue;
            
            const role = msg.role === 'user' ? '**User**' : 
                        msg.role === 'system' ? '**System**' : '**Assistant**';
                        
            const content = msg.content
                .replace(/\r\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n')
                .trim();

            markdown += `### ${role}\n${content}\n\n`;
        }

        return markdown;
    }
}

// Export the class
module.exports = ChatProcessor;

// Run processing if the file is called directly
if (require.main === module) {
    const processor = new ChatProcessor();
    processor.processAllChats().catch(console.error);
} 