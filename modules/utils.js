const express = require("express");
const crypto = require("crypto");
const appConf = require("../appconfig.json");

exports.app = express();

exports.DEV_MODE = exports.app.get("env") === "development";

exports.debug = function () {
  if (exports.DEV_MODE) console.log.apply(console, arguments);
};

exports.db = require("knex").knex(appConf.dbConf);

const dayT = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

const monthN = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

exports.dateFmt = function (date, formatStr) {
  if (!(date instanceof Date)) date = new Date(date);
  // parse function
  function pf(formatChar, dateFuncName, indexShift = 0) {
    const resultVal = (date["get" + dateFuncName]() + indexShift).toString();
    formatStr = formatStr.replace(
      new RegExp("(^|[^$])(" + formatChar + "+)", "g"),
      (match, p1, p2) =>
        p1 + (p2.replace(/./g, "0") + resultVal).slice(-Math.max(p2.length, resultVal.length))
    );
    return pf;
  }
  pf("R", "FullYear")("M", "Month", 1)("D", "Date")("G", "Hours")("I", "Minutes")("S", "Seconds");
  return formatStr
    .replace(/(^|[^$])(N+)/g, (m, a) => a + monthN[date.getMonth()])
    .replace(/(^|[^$])(T+)/g, (m, a) => a + dayT[date.getDay()])
    .replace(/(\$)([^$])/g, "$2");
};

/* Example of usage: dateFmt(new Date(), "T, D. N (DD-MM-RRRR), $Godzina GG:II:SS") */

exports.getUserId = function (session) {
  return session.username + "@" + session.domain;
};

const getSessionStamp = (session) =>
  session.username + session.domain + session.password + JSON.stringify(session.cookies);

exports.signSession = function (session) {
  if (
    session.username &&
    session.password &&
    session.domain &&
    session.cookies &&
    typeof session.cookies.CAKEPHP === "string" &&
    session.cookies.CAKEPHP.length
  ) {
    session.loggedIn = crypto
      .createHmac("sha256", appConf.secret)
      .update(getSessionStamp(session))
      .digest("hex");
    return true;
  } else {
    session.loggedIn = undefined;
    return false;
  }
};

exports.verifySession = function (session) {
  if (session.loggedIn) {
    const hash = crypto
      .createHmac("sha256", appConf.secret)
      .update(getSessionStamp(session))
      .digest("hex");
    if (hash !== session.loggedIn) {
      throw new Error("Session signature error!");
    }
  }
  return true;
};

exports.getTopicHash = function (topic) {
  const words = topic
    .toLowerCase()
    .normalize("NFD") // canonical decomposition
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/\u0142/g, "l") // remove "ł"
    .split(/[^a-z]+/)
    .filter((word) => word.length > 2)
    .sort();
  return crypto
    .createHash("sha1")
    .update([...new Set(words)].join("")) // remove duplicates
    .digest("base64");
};
