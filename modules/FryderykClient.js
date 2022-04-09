const axios = require("axios");
const qs = require("qs");
const { signSession } = require("./utils");

module.exports = class FryderykClient {
  constructor(session) {
    const isObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
    const hasText = (s) => typeof s === "string" && s.length > 0;
    if (
      !hasText(session.domain) ||
      !hasText(session.username) ||
      !hasText(session.password) ||
      !isObject(session.cookies)
    ) {
      throw new Error("FryderykClient: Nieprawidłowa właściwość sesji!");
    }
    this.BASE_URL = "https://" + session.domain + ".fryderyk.edu.pl";
    this.LOGIN_PAYLOAD = qs.stringify({
      _method: "POST",
      username: session.username,
      password: session.password,
    });
    this.session = session;
  }

  static extractCookies(response) {
    const cookies = response.headers["set-cookie"];
    const result = {};
    (Array.isArray(cookies) ? cookies : typeof cookies === "string" ? [cookies] : []).forEach(
      (str) => {
        const pair = str.split(";", 1)[0].split("=", 2);
        result[pair[0]] = pair[1];
      }
    );
    return result;
  }

  _prepareOptions(config) {
    config = Object.assign(config || {}, {
      maxRedirects: 0,
    });
    if (Object.keys(this.session.cookies).length) {
      config.headers = Object.assign(config.headers || {}, {
        Cookie: Object.entries(this.session.cookies)
          .map(([key, val]) => key + "=" + val)
          .join("; "),
      });
    }
    return config;
  }

  async _fetch(url, config, getCode) {
    config = this._prepareOptions(config);
    config.url = url;
    let response;
    try {
      response = await axios(config);
    } catch (error) {
      if (error.response) response = error.response;
      else throw error;
    }
    const responseCode = response.status;
    const redirectUrl = response.headers.location;
    Object.assign(this.session.cookies, FryderykClient.extractCookies(response));
    const loginUrl = this.BASE_URL + "/users/login";
    if (typeof redirectUrl === "string") {
      // HTTP Redirect
      if (redirectUrl.startsWith(loginUrl) && responseCode === 302) {
        // Not Logged In
        config.method = "post";
        config.data = this.LOGIN_PAYLOAD;
        this.session.loggedIn = undefined;
      } else {
        // Logged In
        delete config.method;
        delete config.data;
        signSession(this.session);
      }
      return getCode ? response : await this._fetch(redirectUrl, config);
    } else if (url.startsWith(loginUrl) && config.method === "post") {
      // Login failed
      this.session.cookies = {};
      this.session.loggedIn = undefined;
      throw new Error("FryderykClient: Nieprawidłowy login lub hasło!");
    }
    return response;
  }

  async fetch(path, config, getCode) {
    const response = await this._fetch(this.BASE_URL + path, config, getCode);
    if (getCode) {
      return response.status;
    }
    if (response.status !== 200) {
      throw new Error("FryderykClient: Kod odpowiedzi HTTP " + response.status);
    }
    return response.data;
  }

  async fetchAll(paths, config) {
    config = this._prepareOptions(config);
    return await Promise.all(
      paths.map((path) => {
        return axios(Object.assign({}, config, { url: this.BASE_URL + path }));
      })
    );
  }
};
