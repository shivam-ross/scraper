const TEAM_ID = "aline123";
let knowledgeItems = [];

function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m',
        success: '\x1b[32m',
        error: '\x1b[31m',
        warn: '\x1b[33m',
        reset: '\x1b[0m'
    };
    console.log(`${colors[type] || colors.info}[${new Date().toLocaleTimeString()}] ${message}${colors.reset}`);
}

function findAuthor(document, readabilityArticle) {
    if (readabilityArticle?.byline) {
        return readabilityArticle.byline.trim();
    }

    try {
        const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
            const data = JSON.parse(jsonLdScript.textContent);
            const author = Array.isArray(data.author) ? data.author[0] : data.author;
            if (author?.name) {
                return author.name.trim();
            }
        }
    } catch (err) {
    }

    const meta = document.querySelector('meta[name="author"], meta[property="article:author"]');
    if (meta?.content) return meta.content.trim();

    const knownAuthorEl = document.querySelector('[class*="author"], [id*="author"], [class*="byline"]');
    if (knownAuthorEl) {
        const text = knownAuthorEl.textContent.trim();
        if (text && text.length < 100) return text;
    }

    const keywords = ['creator and contributing author', 'author', 'by', 'written by'];
    const elements = [...document.querySelectorAll('p, div, h6')];

    for (let i = 0; i < elements.length; i++) {
        const text = elements[i].textContent.trim();
        const lower = text.toLowerCase();

        for (const kw of keywords) {
            if (lower.startsWith(kw)) {
                const name = text.slice(kw.length).trim();
                if (name && name.length <= 60) {
                    return name;
                }
            }
        }
    }

    return '';
}

function addKnowledgeItem(item) {
    knowledgeItems.push(item);
}

module.exports = {
    TEAM_ID,
    log,
    findAuthor,
    knowledgeItems, // Export the array directly
    addKnowledgeItem
};