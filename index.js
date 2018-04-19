#!/usr/bin/env node
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

const sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const instance = axios.create({
  baseURL: 'https://api.metadefender.com/v2',
  headers: {
    'apikey': process.env.API_KEY,
  },
});

let file = process.argv[2];
if (!file) {
  console.log('filename should be the third argument.');
  process.exit();
}

if (!fs.existsSync(file)) {
  console.log(`Could not find ${file} in the CWD`);
  process.exit();
}

const printResults = (json) => {
  console.log(json)
  const filename = process.argv[2];
  const overallStatus = json.scan_results.scan_all_result_a;
  console.log('---------- SCAN RESULTS ----------');
  console.log('filename: ', filename);
  console.log('overall_status: ', overallStatus);
  console.log('');

  const scanDetails = json.scan_results.scan_details
  const engines = Object.keys(scanDetails);
  for (let engine of engines) {
    const details = scanDetails[engine];
    console.log('engine: ', engine);
    console.log('threat_found: ', details.threat_found);
    console.log('scan_result: ', details.scan_result_i);
    console.log('def_time: ', details.def_time);
    console.log('');
  }
  console.log('----------------------------------');
  console.log('END');
};

const pollingLoop = async (digest) => {
  let tries = 0;
  while(true) {
    const res = await instance.get(`/hash/${digest}`);
    if (res.data.status === 'inqueue' || res.data[digest] == 'Not Found') {
      console.log('File scan in process...');
      tries += 1;
      await sleep(3);
      if (tries > 10) {
        console.log('Polled 10 times so far. Is your file enormous?');
      }
    } else {
      return res.data;
    }
  }
}

const run = () => {
  const hash = crypto.createHash('sha256');
  const inputStream = fs.createReadStream('./test.txt');
  inputStream.pipe(hash);

  hash.on('readable', async () => {
    const data = hash.read();
    if (data) {
      const fileDigest = data.toString('hex').toUpperCase();
      try {
        const res = await instance.get(`/hash/${fileDigest}`);
        const { data } = res;
        if (data[fileDigest] === 'Not Found') {
          console.log("Hash not found. Attempting file upload")
          try {
            const res = await instance.post('/file', fs.createReadStream('./test.txt'));
            const { data } = res;
            if (data.status === "inqueue") {
              console.log('File has been queued for scanning');
              const results = await pollingLoop(fileDigest);
              if (results) {
                printResults(results);
                process.exit();
              } else {
                console.log('No result')
                process.exit();
              }
            } else {
              console.log('Unable to queue the file for scanning');
              console.log(data);
            }
          } catch (e) {
            if (e.response.status === 500) {
              console.log('Internal Server error, but starting poll loop anyway');
              const results = await pollingLoop(fileDigest);
              if (results) {
                printResults(results);
                process.exit();
              } else {
                console.log('No result')
                process.exit();
              }
            }
            console.log("Something went wrong: ");
            console.log(e);
          }
        } else {
          console.log('Cached result found');
          printResults(data);
        }
      } catch (e) {
        console.log(e);
      }
    }
  });  
};

if (process.env.RUN) {
  run();
} else {
  console.log('RUN environment variable not set');
}
