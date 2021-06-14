const fs = require('fs');
const axios = require('axios').default;
const nodemailer = require('nodemailer');
const parser = require('xml2json');
const _ = require('lodash');
const jsdom = require('jsdom');
const mailData = require('./.auth.json');

const { JSDOM } = jsdom;

const { pass, user, toUser } = mailData;

const transporter = nodemailer.createTransport(`smtps://${user}:${pass}@smtp.gmail.com`);
const mailOptions = {
  from: '"Stock Notifier" <awesomestocknotifier@gmail.com>',
  to: toUser,
  subject: 'Stock Update',
  text: '',
};

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
const prepareObject = ((reports) => reports.map((val) => {
  let ticker;
  if (val.ticker.includes('<')) {
    const dom = new JSDOM(val.ticker);
    ticker = dom.window.document.querySelector('a').textContent;
  } else {
    ticker = val.ticker;
  }
  return {
    ticker,
    type: val.type || val.transaction_type,
  };
}));

const prepareEmail = ((content) => {
  const htmlified = content.map((collection) => {
    const tabled = collection.map((data) => `<tr><td>${data.ticker}</td><td>${data.type}</td>`);
    return tabled;
  });
  return `
    <html>
      <head>
        <style>
          td {
            padding: 10px;
          }
        </style>
      </head>
      <body>
        <table><tr><th>Ticker</th><th>Type</th></tr>${htmlified}</table>
      </body>;
    </html>
    `;
});

const storeSnap = ((content, type) => {
  fs.writeFileSync(`./.${type}Snapshot.json`, JSON.stringify(content));
});

const email = [];
const changed = {
  house: false,
  senate: false,
};
const fileOutput = {
  house: '',
  senate: '',
};

getReports('https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/filemap.xml')
  .then((reports) => convertReports(reports.data))
  .then((converted) => {
    fileOutput.senate = _.clone(converted);
    const newReports = getNewReports(converted, 'senate');
    if (newReports.length > 0) {
      changed.senate = true;
    }
    return getTransactions(newReports, 'https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com');
  })
  .then((reports) => {
    const valid = getValidTickers(reports);
    email.push(prepareObject(valid));
  })
  .then(() => getReports('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/filemap.xml'))
  .then((reports) => convertReports(reports.data))
  .then((converted) => {
    fileOutput.house = _.clone(converted);
    const newReports = getNewReports(converted, 'house');
    if (newReports.length > 0) {
      changed.house = true;
    }
    return getTransactions(newReports, 'https://house-stock-watcher-data.s3-us-west-2.amazonaws.com');
  })
  .then((reports) => {
    const valid = getValidTickers(reports);
    email.push(prepareObject(valid));
  })
  .then(() => {
    if (changed.house || changed.senate) {
      mailOptions.html = prepareEmail(email);
      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          return console.log(err);
        }
        storeSnap(fileOutput.senate, 'senate');
        storeSnap(fileOutput.house, 'house');
        return console.log('Message sent:', info.response);
      });
    } else {
      console.log('no new reports');
    }
  });
