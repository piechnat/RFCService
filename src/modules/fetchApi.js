const cheerio = require("cheerio");
const fetchLib = require("./fetchLib");
const FryderykClient = require("./FryderykClient");
const { dateFmt } = require("./utils");

/*
lesson {
  id: number,
  timestamp: number,
  time: string,
  name: string,
  studentName: string,
  subjectMod: boolean,
  attendMod: boolean,
  subjectPrms: [lesson.id, subjectId: number],
  timePrms: [lesson.timestamp, endTimestamp: number],
  attendPrms: [...[attendId: number, studentId: number]],
  attendance: number,
  subject: string,
}
*/

const fetchApi = {};

fetchApi.getDayLessons = async function (session) {
  const date = new Date(session.strdate);
  if (isNaN(date.getTime())) {
    throw new Error("Nieprawidłowa data w sesji!");
  }
  const client = new FryderykClient(session);
  const dmy = dateFmt(date, "DD-MM-RRRR");
  const ymd = dateFmt(date, "RRRR-MM-DD");
  const $ = cheerio.load(await client.fetch("/plans/mine/" + ymd));
  const lessons = [];
  $("#plan")
    .find(`span:contains(${dmy})`)
    .closest("div.block")
    .each(function () {
      const $block = $(this);
      const time = $block
        .find("span.sr-only > span:nth-child(2)")
        .text()
        .match(/\d{2}:\d{2}/)
        .toString();
      const $name = $block.children("span.text");
      lessons.push({
        id: parseInt($block.data("url").match(/\d+/)) || 0,
        timestamp: new Date(ymd + " " + time).getTime() / 1000,
        time: time,
        name: $name.children("a").text().trim(),
        studentName: $name
          .children()
          .remove()
          .end()
          .text()
          .replace(/(^[\s]*|[\s-]*$)/g, ""),
      });
    });
  return lessons;
};

fetchApi.getLessonDetails = async function (lessons, session) {
  const client = new FryderykClient(session);
  for (const lesson of lessons) {
    Object.assign(
      lesson,
      await fetchLib.getLessonAttendance(lesson, client),
      await fetchLib.getLessonSubject(lesson, client),
      { subjectMod: false, attendMod: false }
    );
  }
  return lessons;
};

fetchApi.setDayLessons = async function (lessons, session) {
  const client = new FryderykClient(session);
  const result = [];
  for (const lesson of lessons) {
    const attendRes = lesson.attendMod ? await fetchLib.setLessonAttendance(lesson, client) : true;
    const subjectRes = lesson.subjectMod
      ? await fetchLib.setLessonSubject(lesson, session.subjectField, client)
      : true;
    if (attendRes && subjectRes) result.push(lesson.subjectPrms.join("|"));
  }
  return result;
};

fetchApi.getLessonInfo = async function (lessonId, session) {
  const path = "/lessons/description/" + lessonId;
  const $ = cheerio.load(await new FryderykClient(session).fetch(path));
  return $(".description-view .section .text").first().html() || "(brak)";
};

fetchApi.getLastSubjects = async function (lessonId, timestamp, session) {
  const $ = cheerio.load(await new FryderykClient(session).fetch("/lessons/subjects/" + lessonId));
  let result = "";
  $(`td[data-ss='${timestamp}']`)
    .closest("tr")
    .nextAll()
    .slice(0, 3)
    .each(function () {
      const $tds = $("td", this);
      result +=
        "<p><small><b>" +
        $tds.eq(0).text() +
        "</b></small>" +
        "<br>" +
        $tds.eq(1).find("a").text() +
        "</p>";
    });
  return result || "(brak)";
};

fetchApi.getSubjectField = async function (subjectPrms, session) {
  const path = "/lessons/subjects-edit/" + subjectPrms.join("/");
  return cheerio
    .load(await new FryderykClient(session).fetch(path))("#subject")
    .attr("name");
};

fetchApi.topicBaseAdd = async function (topic, session) {};

fetchApi.topicBaseFind = async function (search, session) {};

fetchApi.synchronizeSubjectBase = function (clientAccess, clientList, session) {
  return { access: 0, result: false };
  /*
  clientAccess = parseInt(clientAccess) || 0;
  const userId = session.username + "@" + session.domain;
  Fl.sheetDB.init().set(userId, new Date(), 2);
  const serverAccess = parseInt(Fl.sheetDB.get(userId, 0)[0]) || 0;
  if (clientAccess !== serverAccess) {
    if (clientAccess > serverAccess) {
      if (Array.isArray(clientList)) {
        Fl.sheetDB.set(userId, [clientAccess, JSON.stringify(clientList)]);
        return { access: clientAccess, result: true };
      }
    } else {
      let serverList = Fl.sheetDB.get(userId, 1)[0];
      try {
        if (Array.isArray((serverList = JSON.parse(serverList)))) {
          return { access: serverAccess, result: serverList };
        }
      } catch (e) {}
    }
  }
  return { access: serverAccess, result: false };
  */
};

module.exports = fetchApi;
