const axios = require("axios").default;
const {
    apiKey_freshdesk,
    url_freshDesk
} = require("../utils/config")
const Freshdesk = require("freshdesk-api");
const freshdesk = new Freshdesk(url_freshDesk, apiKey_freshdesk);
const logger = require("../utils/logger");
const getInfo = require("../common");
async function ticketCreater(req) {
    try {

        const freshDeskData = {
            description: req.description,
            subject: req.subject,
            phone: req.phone,
            priority: req.priority,
            status: req.status,
            name: req.name
        }

        freshdesk.createTicket(freshDeskData,
            async function (err, data) {
                if (data) {
                    let status = "PENDING"
                    if (data.status == 2) {
                        status = "OPEN"
                    }
                    if (data.status == 3) {
                        status = "PENDING"
                    }
                    if (data.status == 4) {
                        status = "RESOLVED"
                    }
                    await db.collection("issue_raise").findOneAndUpdate(
                        {
                            ticket_id: req.id,
                        },
                        {
                            $set: {
                                freshdesk_id: data.id,
                                status: status
                            },
                        }
                    );
                }
            }
        );

    } catch (error) {
        logger.info("error---->", error);
        getInfo.exceptionError(error);

    }
    //return res;
}
async function viewticket(req_id) {
    try {
        freshdesk.getTicket(req_id,
            async function (err, data, extra) {
                console.log(err || data);
                if (data) {
                    let status = "PENDING"
                    if (data.status == 2) {
                        status = "OPEN"
                    }
                    if (data.status == 3) {
                        status = "PENDING"
                    }
                    if (data.status == 4) {
                        status = "RESOLVED"
                    }
                    await db.collection("issue_raise").findOneAndUpdate(
                        {
                            freshdesk_id: req_id,
                        },
                        {
                            $set: {
                                freshdesk_status: data.status,
                                status: status
                            },
                        }
                    );
                }
            });

    } catch (error) {
        logger.info("error---->", error);
        getInfo.exceptionError(error);

    }

}

module.exports = {
    ticketCreater,
    viewticket
};
