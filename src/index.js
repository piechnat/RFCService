const { app, DEV_MODE, debug, verifySession } = require("./modules/utils");
const { json } = require("express");
const FetchApi = require("./modules/FetchApi");

app.use(json());
if (DEV_MODE) app.use(require("cors")());

async function rfCall(fname, args, session) {
  verifySession(session);
  if (typeof FetchApi[fname] !== "function" || fname.charAt(0) === "_") {
    throw new Error("RFCService function does not exist!");
  }
  return { value: await FetchApi[fname](...args, session), session: session };
}

app.post("/rfcservice", async (request, response) => {
  try {
    const { fname, args, session } = request.body;
    const result = await rfCall(fname, args, session);
    response.send(result);
  } catch (error) {
    debug(error);
    response.statusCode = 400;
    response.send(error.message + " [S]");
  }
});

app.listen(80);
