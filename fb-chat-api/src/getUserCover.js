"use strict";

const fs = require("fs");
const axios = require("axios");
const utils = require("../utils");
const log = require("npmlog");

function extractCoverUrl(html) {
    const match = html.match(/<link[^>]+href="(https:\/\/scontent[^"]+\.fbcdn\.net[^"]+)"/);
    if (match && match[1]) {
        return match[1].replace(/&amp;/g, "&");
    }
    return null;
}

module.exports = function (defaultFuncs, api, ctx) {
    return function getUserCover(identifier, callback) {
        let resolveFunc = function () { };
        let rejectFunc = function () { };
        const returnPromise = new Promise(function (resolve, reject) {
            resolveFunc = resolve;
            rejectFunc = reject;
        });

        if (!callback) {
            callback = function (err, coverUrl) {
                if (err) return rejectFunc(err);
                resolveFunc(coverUrl);
            };
        }

        let usernameOrId = identifier;
        if (identifier.startsWith("https://www.facebook.com/")) {
            usernameOrId = identifier.replace("https://www.facebook.com/", "").replace(/\/$/, "");
        }

        const raw = fs.readFileSync('account.txt', 'utf8');
        const cookiesJSON = JSON.parse(raw);
        const cookies = cookiesJSON.map(c => `${c.key}=${c.value}`).join('; ');

        axios.get(`https://www.facebook.com/${usernameOrId}`, {
            headers: {
                "Cookie": cookies,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9"
            }
        })
            .then(res => {
                const html = res.data;
                const coverUrl = extractCoverUrl(html);
                if (coverUrl) {
                    callback(null, coverUrl);
                } else {
                    callback(new Error("Cover URL not found"), null);
                }
            })
            .catch(err => {
                log.error("getUserCover", err.response?.status, err.response?.statusText);
                callback(err, null);
            });

        return returnPromise;
    };
};
