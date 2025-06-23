const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { processSource } = require('./src/scraper');
const { log, knowledgeItems, TEAM_ID } = require('./src/utils');

async function main() {
    const argv = yargs(hideBin(process.argv))
        .option('url', {
            alias: 'u',
            type: 'string',
            description: 'URL of a blog post or blog index to scrape'
        })
        .option('pdf', {
            alias: 'p',
            type: 'string',
            description: 'Path to a PDF file to process'
        })
        .check((argv) => {
            if (!argv.url && !argv.pdf) {
                throw new Error('You must provide either a URL (--url) or a PDF path (--pdf)');
            }
            if (argv.url && argv.pdf) {
                throw new Error('Please provide only one of --url or --pdf at a time');
            }
            return true;
        })
        .help()
        .alias('help', 'h')
        .argv;

    await processSource(argv);

    const finalJson = {
        team_id: TEAM_ID,
        items: knowledgeItems,
    };
    
    if (knowledgeItems.length > 0) {
        console.log(JSON.stringify(finalJson, null, 2));
    } else {
        log('No content could be extracted. Final output is empty.', 'error');
    }
}

main();