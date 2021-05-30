const fs = require('fs');
const axios = require('axios').default;
const nodemailer = require('nodemailer');
const parser = require('xml2json');

const reports = [];
axios.get('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/filemap.xml')
  .then((resp) => {
    if (fs.existsSync('./.housesnapshot.xml')) {
      const oldSnapshot = fs.readFileSync('./.housesnapshot.xml', 'utf-8');
      const json = JSON.parse(parser.toJson(oldSnapshot));
      const latest = json.listBucketFileMap.Contents[0].Key.replace(/"/g, '');
      axios.get(`https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/${latest}`)
        .then((report) => {
          report.data.forEach((person) => {
            person.transactions.forEach((transaction) => {
              if (transaction.ticker !== 'NWN') {
                reports.push(`${transaction.ticker}: ${transaction.transaction_type}`);
              }
            });
          });
        })
        .catch((error) => {
          console.log(error);
        });
    } else {
      fs.writeFileSync('.housesnapshot.xml', resp.data);
    }
  })
  .catch((error) => {
    console.log(error);
  });

axios.get('https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/filemap.xml')
  .then((resp) => {
    if (fs.existsSync('./.housesnapshot.xml')) {
      const oldSnapshot = fs.readFileSync('./.housesnapshot.xml', 'utf-8');
      const json = JSON.parse(parser.toJson(oldSnapshot));
      const latest = json.listBucketFileMap.Contents[0].Key.replace(/"/g, '');
      axios.get(`https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/${latest}`)
        .then((report) => {
          report.data.forEach((person) => {
            person.transactions.forEach((transaction) => {
              if (transaction.ticker !== 'NWN') {
                reports.push(`${transaction.ticker}: ${transaction.transaction_type}`);
              }
            });
          });
        })
        .catch((error) => {
          console.log(error);
        });
    } else {
      fs.writeFileSync('.housesnapshot.xml', resp.data);
    }
  })
  .catch((error) => {
    console.log(error);
  });
