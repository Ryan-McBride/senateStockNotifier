const fs = require('fs');
const axios = require('axios').default;
const nodemailer = require('nodemailer');
const parser = require('xml2json');
const _ = require('lodash');

const getReports = async (url) => axios.get(url);
const convertReports = (data) => {
  const conv = JSON.parse(parser.toJson(data)).listBucketFileMap.Contents.map((val) => val.Key);
  return conv;
};
const getSnapshot = (type) => JSON.parse(fs.readFileSync(`./.${type}Snapshot.json`));
const getTransactions = (reports, url) => Promise.all(reports.map((report) => axios.get(`${url}/${report}`)))
  .then((transactions) => {
    const t = transactions.map((val) => val.data);
    return t.flat().map((val) => val.transactions.flat());
  })
  .catch((err) => {
    console.log(err);
  });
const getNewReports = (converted, type) => {
  const newReports = [];
  const snapshot = getSnapshot(type);
  while (!_.isEqual(converted, snapshot)) {
    newReports.push(converted.shift());
  }
  return newReports;
};
const getValidTickers = ((reports) => reports.flat().filter((report) => report.ticker !== '--'));
const prepareText = ((reports) => reports.map((val) => `${val.type || val.transaction_type} ${val.ticker}`));
const storeSnap = ((content, type) => {
  fs.writeFileSync(`./.${type}Snapshot.json`, JSON.stringify(content));
});

const email = [];
let fileOutput;

getReports('https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/filemap.xml')
  .then((reports) => convertReports(reports.data))
  .then((converted) => {
    const newReports = getNewReports(converted, 'senate');
    return getTransactions(newReports, 'https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com');
  })
  .then((reports) => {
    const valid = getValidTickers(reports);
    email.push(prepareText(valid));
  })
  .then(() => getReports('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/filemap.xml'))
  .then((reports) => convertReports(reports.data))
  .then((converted) => {
    const newReports = getNewReports(converted, 'house');
    fileOutput = converted;
    return getTransactions(newReports, 'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com');
  })
  .then((reports) => {
    const valid = getValidTickers(reports);
    email.push(prepareText(valid));
  })
  .then(() => {
    console.log(email);
  });
