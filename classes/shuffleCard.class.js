const fortuna = require('javascript-fortuna');
const _ = require("underscore");
fortuna.init();

// code for shuffling cards

const shuffleCards = (Cards) => {
    //shuffle the cards
    /* +-------------------------------------------------------------------+
        desc: function to shuffle cards
        i/p : Cards  = array of cards 
        o/p : array of shuffled cards
         +-------------------------------------------------------------------+ */
    let cards = [...Cards];
    let shuffle = [];

    while (cards.length > 0) {

        let rt = Math.floor(fortuna.random() * cards.length);

        shuffle.push(cards[rt]);
        cards.splice(rt, 1);
    }
    return shuffle;
};
const cardDistribution = (pi, ms, gt) => {
    //generates cards for the game
    /* +-------------------------------------------------------------------+
        desc: function to generate cards for players with random order 
        i/p : pi = array of players' details,
              ms = max seats on table,
              gt = game Type(point,pool,deal)
        o/p : object of cards details; sCards = 2D cards array for the players
                         wildCard = wildcard
                         cDeck = cards array for close deck
                         tCard = first card to show on open deck
         +-------------------------------------------------------------------+ */
    let cards = [
        "f-1-0",
        "f-2-0",
        "f-3-0",
        "f-4-0",
        "f-5-0",
        "f-6-0",
        "f-7-0",
        "f-8-0",
        "f-9-0",
        "f-10-0",
        "f-11-0",
        "f-12-0",
        "f-13-0",
        "l-1-0",
        "l-2-0",
        "l-3-0",
        "l-4-0",
        "l-5-0",
        "l-6-0",
        "l-7-0",
        "l-8-0",
        "l-9-0",
        "l-10-0",
        "l-11-0",
        "l-12-0",
        "l-13-0",
        "k-1-0",
        "k-2-0",
        "k-3-0",
        "k-4-0",
        "k-5-0",
        "k-6-0",
        "k-7-0",
        "k-8-0",
        "k-9-0",
        "k-10-0",
        "k-11-0",
        "k-12-0",
        "k-13-0",
        "c-1-0",
        "c-2-0",
        "c-3-0",
        "c-4-0",
        "c-5-0",
        "c-6-0",
        "c-7-0",
        "c-8-0",
        "c-9-0",
        "c-10-0",
        "c-11-0",
        "c-12-0",
        "c-13-0",
        "f-1-1",
        "f-2-1",
        "f-3-1",
        "f-4-1",
        "f-5-1",
        "f-6-1",
        "f-7-1",
        "f-8-1",
        "f-9-1",
        "f-10-1",
        "f-11-1",
        "f-12-1",
        "f-13-1",
        "l-1-1",
        "l-2-1",
        "l-3-1",
        "l-4-1",
        "l-5-1",
        "l-6-1",
        "l-7-1",
        "l-8-1",
        "l-9-1",
        "l-10-1",
        "l-11-1",
        "l-12-1",
        "l-13-1",
        "k-1-1",
        "k-2-1",
        "k-3-1",
        "k-4-1",
        "k-5-1",
        "k-6-1",
        "k-7-1",
        "k-8-1",
        "k-9-1",
        "k-10-1",
        "k-11-1",
        "k-12-1",
        "k-13-1",
        "c-1-1",
        "c-2-1",
        "c-3-1",
        "c-4-1",
        "c-5-1",
        "c-6-1",
        "c-7-1",
        "c-8-1",
        "c-9-1",
        "c-10-1",
        "c-11-1",
        "c-12-1",
        "c-13-1",
        "j-1-0",
        "j-2-0",
    ];

    if (gt === "Deal" && ms === 2) {
        cards = [
            "f-1-0",
            "f-2-0",
            "f-3-0",
            "f-4-0",
            "f-5-0",
            "f-6-0",
            "f-7-0",
            "f-8-0",
            "f-9-0",
            "f-10-0",
            "f-11-0",
            "f-12-0",
            "f-13-0",
            "l-1-0",
            "l-2-0",
            "l-3-0",
            "l-4-0",
            "l-5-0",
            "l-6-0",
            "l-7-0",
            "l-8-0",
            "l-9-0",
            "l-10-0",
            "l-11-0",
            "l-12-0",
            "l-13-0",
            "k-1-0",
            "k-2-0",
            "k-3-0",
            "k-4-0",
            "k-5-0",
            "k-6-0",
            "k-7-0",
            "k-8-0",
            "k-9-0",
            "k-10-0",
            "k-11-0",
            "k-12-0",
            "k-13-0",
            "c-1-0",
            "c-2-0",
            "c-3-0",
            "c-4-0",
            "c-5-0",
            "c-6-0",
            "c-7-0",
            "c-8-0",
            "c-9-0",
            "c-10-0",
            "c-11-0",
            "c-12-0",
            "c-13-0",
            "j-1-0",
        ];
    }

    let shuffle = shuffleCards(cards);

    let temp;
    if (pi.length == 2) {
        temp = [[], []];
    } else if (pi.length == 3) {
        temp = [[], [], []];
    } else if (pi.length == 4) {
        temp = [[], [], [], []];
    } else {
        temp = [[], [], [], [], [], []];
    }

    //giving 13 cards for each player

    for (let i in pi) {
        if (
            !_.isEmpty(pi[i]) &&
            typeof pi[i].si != "undefined" &&
            pi[i].si != null &&
            pi[i].s == "playing"
        ) {
            temp[i] = shuffle.splice(0, 13);
        }
    }

    //selecting wildCards
    //if joker comes in wildCard then card shifting takes place until we get card that is not joker
    while (shuffle[0] && shuffle[0].split("-")[0] == "j") {
        shuffle.push(shuffle[0]);
        shuffle.splice(0, 1);
    }
    let wildCard = shuffle.splice(0, 1)[0];

    //selecting first face up card
    let tCard = shuffle.splice(0, 1)[0]; //first cards to show

    let final = {
        sCards: temp,           //selected cards 
        wildCard: wildCard,     //wildcard
        cDeck: shuffle,         //close deck cards
        tCard: tCard,
    };

    return final;
};


module.exports = { shuffleCards, cardDistribution };

