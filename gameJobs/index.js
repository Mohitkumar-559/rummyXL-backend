const Queues = require("./queue.class");

const QueuesInstance = (function () {
    let instance;

    function createInstance() {
        return new Queues();
    }

    return {
        getInstance: function () {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        }
    };
})();

module.exports = QueuesInstance;