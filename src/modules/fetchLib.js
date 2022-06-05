const cheerio = require("cheerio");
const qs = require("qs");

const ABSENCE_LIST = [
  "present",
  "absence",
  "explained-absence",
  "not-excused",
  "late",
  "out-earlier",
  "other-present",
  "other-absence",
];

function urlSlice(url, begin, end) {
  return url
    .split("/")
    .filter((s) => s.length)
    .slice(begin, end);
}

const FetchLib = {};

FetchLib.getLessonAttendance = async function (lesson, client) {
  const $ = cheerio.load(
    await client.fetch(`/lessons/attendance/${lesson.id}/${lesson.timestamp}`)
  );
  const attendPrms = [];
  const $cells = $(`.dates .cell [data-date='${lesson.timestamp}']`);
  $cells.each(function () {
    attendPrms.push(urlSlice($(this).data("url"), 2, 4));
  });
  const $cell = $cells.first();
  return {
    attendance: ABSENCE_LIST.indexOf($cell.children("div").data("absence")) + 1,
    timePrms: urlSlice($cell.data("url"), 5),
    attendPrms: attendPrms,
  };
};

FetchLib.getLessonTopic = async function (lesson, client) {
  const $ = cheerio.load(await client.fetch("/lessons/subjects/" + lesson.id));
  const $link = $(`td[data-ss='${lesson.timestamp}']`).parent().find("a");
  if (!$link.length) {
    throw new Error("Temat zajęć niedostępny!");
  }
  return {
    topic: $link.hasClass("text-light") ? "" : $link.text().trim(),
    topicPrms: urlSlice($link.attr("href"), 2),
  };
};

FetchLib.setLessonAttendance = async function (lesson, client) {
  return (
    await client.fetchAll(
      lesson.attendPrms.map(
        (attendStud) =>
          "/lessons-attendances/set-single/" +
          [
            ...attendStud.split(","),
            lesson.topicPrms[0],
            ...lesson.timePrms,
            lesson.attendance,
          ].join("/")
      )
    )
  ).every((response) => response.status === 200 && response.data?.type === lesson.attendance);
};

FetchLib.setLessonTopic = async function (lesson, subjectField, client) {
  return (
    (await client.fetch(
      "/lessons/subjects-edit/" + lesson.topicPrms.join("/"),
      {
        method: "post",
        data: qs.stringify({ _method: "PUT", [subjectField]: lesson.topic }),
      },
      true
    )) === 302
  );
};

module.exports = FetchLib;
