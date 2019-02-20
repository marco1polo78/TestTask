const PATH_TO_ZIP = process.argv[2];
const ENCODING = 'utf-8';

const extractZip = require('extract-zip');
const path = require('path');
const fs = require('fs-extra');
const csvStream = require('csv-stream-to-json');
const moment = require('moment');

const ZIP_NAME = path.parse(PATH_TO_ZIP).name;
const EXTRACTED_DIR = path.join(__dirname, ZIP_NAME);
const RESULT_JSON = path.join(__dirname, 'result.json');

let isFirstObj = true;

async function main() {

    // extract files to zip
    await new Promise( (resolve, reject) => {
        fs.mkdirSync(EXTRACTED_DIR);
        
        extractZip(PATH_TO_ZIP, { dir: EXTRACTED_DIR }, err => {
            if (err) throw err;
            console.log('Finished extracting');
            resolve();
        });
    });

    // parsing files
    fs.writeFileSync(RESULT_JSON, '[\n', ENCODING);
    const filesPath = fs.readdirSync(EXTRACTED_DIR);
    
    await filesPath.reduce( (acc, filename) => {
            return acc
                .then(parseFile.bind({ filepath: filename }))
            ;

        }, Promise.resolve() )
        .then(() => {
            fs.removeSync(EXTRACTED_DIR);
            console.log(`Parsing finished. Please check ${RESULT_JSON} for results`);
        });

    // single file parsing logic
    function parseFile() {
        return new Promise( (resolve, reject) => {
            const readStream = fs.createReadStream(path.join(EXTRACTED_DIR, this.filepath));
            
            csvStream.parse(readStream, "||", false, json => {
                // console.log('json', json);
                const infoObj = {
                    name: trimQuotes(json['"name"']),
                    phone: trimQuotes(json['"phone"'].replace(/[^\d]/g, '')),
                    date: moment( trimQuotes(json['"date"']), 'DD/MM/YYYY' ).format('YYYY-MM-DD'),
                    costCenterNum: trimQuotes(json['"cc"'].replace(/[^\d]/g, ''))
                };

                let objStr;
                if (isFirstObj) {
                    isFirstObj = false;
                    objStr = beautifyObject(infoObj)
                } else {
                    objStr = ',\n' + beautifyObject(infoObj);
                }

                fs.appendFileSync(RESULT_JSON, objStr, ENCODING);
            }, resolve); 
        } );
    }

    // add closing bracket for array end
    fs.appendFileSync(RESULT_JSON, '\n]', ENCODING);
}

main();

function beautifyObject(obj) {
    const JSONStr = JSON.stringify(obj, null, 2)
        .split('\n')
        .map(str => '\t' + str)
        .join('\n');
    
    return JSONStr;
}

function trimQuotes(str) {
    return str.replace(/['"]/g, '');
}
