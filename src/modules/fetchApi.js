const cheerio = require("cheerio");
const FetchLib = require("./FetchLib");
const FryderykClient = require("./FryderykClient");
const { dateFmt, db, verifyLogin, getTopicHash } = require("./utils");

/*
lesson {
  id: number,
  timestamp: number,
  time: string,
  subject: string,
  student: string,
  topicMod: boolean,
  attendMod: boolean,
  topicPrms: [lesson.id, subjectId: number],
  timePrms: [lesson.timestamp, endTimestamp: number],
  attendPrms: [...[attendId: number, studentId: number]],
  attendance: number,
  topic: string,
}
*/

const FetchApi = {};

FetchApi.getDayLessons = async function (session) {
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
        subject: $name.children("a").text().trim(),
        student: $name
          .children()
          .remove()
          .end()
          .text()
          .replace(/(^[\s]*|[\s-]*$)/g, ""),
      });
    });
  return lessons;
};

FetchApi.getLessonDetails = async function (lessons, session) {
  const client = new FryderykClient(session);
  for (const lesson of lessons) {
    Object.assign(
      lesson,
      await FetchLib.getLessonAttendance(lesson, client),
      await FetchLib.getLessonTopic(lesson, client),
      { topicMod: false, attendMod: false }
    );
  }
  return lessons;
};

FetchApi.setDayLessons = async function (lessons, session) {
  const client = new FryderykClient(session);
  const result = [];
  for (const lesson of lessons) {
    const attendRes = lesson.attendMod ? await FetchLib.setLessonAttendance(lesson, client) : true;
    const topicRes = lesson.topicMod
      ? await FetchLib.setLessonTopic(lesson, session.subjectField, client)
      : true;
    if (attendRes && topicRes) result.push(lesson.topicPrms.join("|"));
  }
  return result;
};

FetchApi.getLessonInfo = async function (lessonId, session) {
  const path = "/lessons/description/" + lessonId;
  const $ = cheerio.load(await new FryderykClient(session).fetch(path));
  return $(".description-view .section .text").first().html() || "(brak)";
};

FetchApi.getLastTopics = async function (lessonId, timestamp, session) {
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

FetchApi.getSubjectField = async function (topicPrms, session) {
  const path = "/lessons/subjects-edit/" + topicPrms.join("/");
  return cheerio
    .load(await new FryderykClient(session).fetch(path))("#subject")
    .attr("name");
};

const TOPICS = "topics";

const createRow = (topic, subject, session) => ({
  id: getTopicHash(topic),
  author: session.username,
  domain: session.domain,
  subject: subject,
  content: topic,
});

FetchApi.topicBaseFetch = async function (session) {
  verifyLogin(session);
  return await db(TOPICS).select().where({ author: session.username, domain: session.domain });
};

FetchApi.topicBaseAdd = async function (topic, subject, session) {
  verifyLogin(session);
  const row = createRow(topic, subject, session);
  try {
    await db(TOPICS).insert(row);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new Error("Podany temat już istnieje w bazie!");
    }
    throw error;
  }
  return row;
};

FetchApi.topicBaseRemove = async function (id, session) {
  verifyLogin(session);
  return await db(TOPICS).del().where("id", id);
};

FetchApi.topicBaseUpdate = async function (id, topic, subject, session) {
  verifyLogin(session);
  const row = createRow(topic, subject, session);
  try {
    await db(TOPICS).insert(row);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new Error("Podany temat już istnieje w bazie!");
    }
    throw error;
  }
  await db(TOPICS).del().where("id", id);
  return row;
};

FetchApi.topicBaseFind = async function (query, session) {
  verifyLogin(session);
  throw new Error("Not implemented!");
};

module.exports = FetchApi;
