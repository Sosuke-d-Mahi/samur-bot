"use_strict";
/**
 * @author Isai Ivanov
 */

const { generateOfflineThreadingID } = require('../utils');

/**
 * A function for changing the nickname of a participant in a thread.
 * @param {string} nickname - The new nickname to set.
 * @param {string} threadID - The ID of the thread where the nickname will be changed.
 * @param {string} participantID - The ID of the participant whose nickname will be changed.
 * @param {Object} callback - Callback for the function.
 */

module.exports = function (defaultFuncs, api, ctx) {
    return function changeNicknameMqtt(nickname, threadID, participantID, callback) {
        if (!ctx.mqttClient) {
            throw new Error('Not connected to MQTT');
        }

        ctx.wsReqNumber += 1;
        ctx.wsTaskNumber += 1;

        const queryPayload = {
            thread_key: threadID,
            contact_id: participantID,
            nickname: nickname,
            sync_group: 1
        };

        const query = {
            failure_count: null,
            label: '44',
            payload: JSON.stringify(queryPayload),
            queue_name: 'thread_participant_nickname',
            task_id: ctx.wsTaskNumber
        };

        const context = {
            app_id: '2220391788200892',
            payload: {
                epoch_id: parseInt(generateOfflineThreadingID()),
                tasks: [query],
                version_id: '8222381697807406'
            },
            request_id: ctx.wsReqNumber,
            type: 3
        };

        context.payload = JSON.stringify(context.payload);

        ctx.mqttClient.publish('/ls_req', JSON.stringify(context), { qos: 1, retain: false });
    };
};