const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const TurndownService = require('turndown');
const pdf = require('pdf-parse');
const fs = require('fs');

const { findAuthor, knowledgeItems, addKnowledgeItem } = require('./utils');

const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

async function fetchHtml(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        return data;
    } catch (error) {
        console.log(`Failed to fetch ${url}. Error: ${error.message}`, 'error');
        return null;
    }
}

function scrapeArticlePage(url, htmlContent) {
    try {
        const dom = new JSDOM(htmlContent, { url });
        const document = dom.window.document;

        const reader = new Readability(document.cloneNode(true));
        const article = reader.parse();

        if (article && article.content) {
            let finalTitle = article.title;
            let headlineElement = document.querySelector('main h1, article h1');

            if (!headlineElement) {
                const header = document.querySelector('header');
                const allElements = [...document.body.querySelectorAll('*')];

                let headerPassed = false;
                for (const el of allElements) {
                    if (el === header) {
                        headerPassed = true;
                        continue;
                    }
                    if (
                        headerPassed &&
                        el.tagName === 'H1' &&
                        (!header || !header.contains(el))
                    ) {
                        headlineElement = el;
                        break;
                    }
                }
            }

            if (headlineElement) {
                finalTitle = headlineElement.textContent.trim();
            }

            const author = findAuthor(document, article);

            const markdownContent = turndownService.turndown(article.content);

            addKnowledgeItem({
                title: finalTitle,
                content: markdownContent,
                content_type: 'blog',
                source_url: url,
                author: author,
                user_id: ''
            });
            return true;
        }

        return false;
    } catch (error) {
        console.log(`Error during parsing attempt at ${url}: ${error.message}`, 'error');
        return false;
    }
}

async function crawlAndScrape(baseUrl, htmlContent) {
    const doc = new JSDOM(htmlContent, { url: baseUrl }).window.document;
    const base = new URL(baseUrl);
    const links = new Set();

    doc.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        if (href) {
            try {
                const absoluteUrl = new URL(href, base.href).href;
                const path = new URL(absoluteUrl).pathname;
                if (absoluteUrl.startsWith(base.origin) && path.split('/').filter(Boolean).length > 1) {
                    links.add(absoluteUrl);
                }
            } catch (e) { /* Ignore invalid URLs */ }
        }
    });

    if (links.size > 0) {
        for (const link of Array.from(links)) {
            const linkHtml = await fetchHtml(link);
            if (linkHtml) {
                scrapeArticlePage(link, linkHtml);
            }
        }
    } else {
        console.log('No further article links found on this page.', 'info');
    }
}

async function processPdf(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return;
        }
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        const fullText = data.text;

        const chapterRegex = /(?:CHAPTER|Chapter)\s+\d+[:\.\s\n]+([^\n]+)/g;
        const chapterLimit = 8;
        const chapters = fullText.split(chapterRegex);
        const author = data.info.Creator.toString();

        if (chapters.length > 1) {
            const numChaptersFound = Math.floor(chapters.length / 2);

            for (let i = 1; i < chapters.length && (i / 2) < chapterLimit; i += 2) {
                const title = `Chapter ${Math.ceil(i / 2)}: ${chapters[i].trim()}`;
                const content = chapters[i + 1].trim();
                addKnowledgeItem({
                    title: title,
                    content: content,
                    content_type: 'book',
                    source_url: `local_pdf:${filePath}`,
                    author: author,
                    user_id: ''
                });
            }
        } else {
            addKnowledgeItem({
                title: filePath.split(/[\\/]/).pop(),
                content: fullText.trim(),
                content_type: 'book',
                source_url: `local_pdf:${filePath}`,
                author: author,
                user_id: ''
            });
        }
    } catch (error) {
        console.log(`Error processing PDF: ${error.message}`, 'error');
    }
}

async function processSource(argv) {
    if (argv.url) {
        const url = argv.url;
        const html = await fetchHtml(url);
        if (html) {
            const wasScrapedAsArticle = scrapeArticlePage(url, html);
            if (!wasScrapedAsArticle) {
                console.log(`Could not parse as a single article. Assuming it's an index page and starting crawl...`, 'warn');
                await crawlAndScrape(url, html);
            }
        }
    } else if (argv.pdf) {
        await processPdf(argv.pdf);
    }
}

module.exports = {
    processSource
};