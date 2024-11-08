module.exports = {
    // Paths to directories
    directories: {
        backup: './backup',
        target: './chatReader',
    },

    // Files settings
    files: {
        database: {
            name: 'state.vscdb',
            backupPattern: /vscdb.*backup/i
        }
    },

    // Analysis settings
    analysis: {
        // Minimum text length to save the conversation
        minTextLength: 100,
        // Maximum number of tags to extract
        maxTerms: 10
    },

    // Templates for formatting
    templates: {
        markdown: {
            filename: (title) => title
                .replace(/[^a-z0-9]/gi, '-')
                .toLowerCase()
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, ''),
            
            dateFormat: (date) => date.toISOString().split('T')[0]
        }
    }
}; 