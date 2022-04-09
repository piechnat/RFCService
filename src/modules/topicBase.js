const { db, getTopicHash } = require("./utils");

const topicBase = {};

topicBase.process = async function (topicRec) {
  const { action, id, ...data } = topicRec;
  data.id = getTopicHash(data.content);
  switch (action) {
    case "ADD":
      return await db("topics").insert(data);
    case "EDIT":
      return await db("topics").where("id", "=", id).update(data);
    case "DELETE":
      return await db.delete().where("id", "=", id);
  }
};

topicBase.fetch = async function (idOrUser) {
  return await db("topics")
    .select()
    .where(idOrUser.includes("@") ? "author" : "id", "=", idOrUser);
};

topicBase.find = async function () {};

module.exports = topicBase;
