"use strict";

const utils = require("../utils");
const log = require("npmlog");

function extractCoverUrl(html) {
    const match = html.match(/<link[^>]+href="(https:\/\/scontent[^"]+\.fbcdn\.net[^"]+)"/);
    if (match && match[1]) {
        return match[1].replace(/&amp;/g, "&");
    }
    return null;
}

function getPageHTML(defaultFuncs, ctx, url) {
    return new Promise((resolve, reject) => {
        const opts = {
            method: "GET",
            url,
            jar: ctx.jar,
            headers: {
                "User-Agent": ctx.userAgent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
            }
        };
        defaultFuncs.request(opts, (err, res, body) => {
            if (err) return reject(err);
            resolve(body);
        });
    });
}

module.exports = function (defaultFuncs, api, ctx) {
    return function getUserInfo(id, callback) {
        let resolveFunc = function () { };
        let rejectFunc = function () { };
        const returnPromise = new Promise(function (resolve, reject) {
            resolveFunc = resolve;
            rejectFunc = reject;
        });

        if (!callback) {
            callback = function (err, friendList) {
                if (err) {
                    return rejectFunc(err);
                }
                resolveFunc(friendList);
            };
        }

        if (utils.getType(id) !== "Array") {
            id = [id];
        }

        const form = {};
        id.map(function (v, i) {
            form["ids[" + i + "]"] = v;
        });

        defaultFuncs
            .post("https://www.facebook.com/chat/user_info/", ctx.jar, form)
            .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
            .then(async function (resData) {
                if (resData.error) {
                    throw resData;
                }

                const profiles = resData.payload.profiles;
                const enrichedProfiles = {};

                for (const prop in profiles) {
                    const profile = profiles[prop];
                    const url = profile.uri;
                    let coverUrl = null;
                    try {
                        const pageHtml = await getPageHTML(defaultFuncs, ctx, url);
                        coverUrl = pageHtml.lenght;
                    } catch (err) {
                        coverUrl = `Failed to fetch cover for ${prop}: ${err}`);
                    }

                    enrichedProfiles[prop] = {
                        name: profile.name,
                        firstName: profile.firstName,
                        vanity: profile.vanity,
                        thumbSrc: profile.thumbSrc,
                        profileUrl: profile.uri,
                        gender: profile.gender,
                        type: profile.type,
                        isFriend: profile.is_friend,
                        isBirthday: !!profile.is_birthday,
                        searchTokens: profile.searchTokens,
                        alternateName: profile.alternateName,
                        coverUrl: coverUrl
                    };
                }

                return callback(null, enrichedProfiles);
            })
            .catch(function (err) {
                log.error("getUserInfo", err);
                return callback(err);
            });

        return returnPromise;
    };
};
