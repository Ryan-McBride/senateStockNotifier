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

getReports('https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/filemap.xml')
  .then((reports) => convertReports(reports.data))
  .then((converted) => {
    const newReports = [];
    const snapshot = getSnapshot('senate');
    while (!_.isEqual(converted, snapshot)) {
      newReports.push(converted.shift());
    }
    return getTransactions(newReports, 'https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com');
  })
  .then((reports) => {
    console.log(reports);
  });
