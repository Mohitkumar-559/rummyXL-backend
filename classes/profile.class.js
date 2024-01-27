const commonClass = require("./common.class");
const getInfo = require("../common");
const logger = require("../utils/logger");

const ChangeGameSetting = (data, client) => {
  try {
    //Change Game Settings  data = {flag}
    /* +-------------------------------------------------------------------+
            desc:event to change game settings 
            i/p: data = {flag = sound/vibrate} 0-on, 1-off
            o/p: ChangeGameSetting event : data = {flag = sound/vibrate, sts = 1/0}, { point, deal, pool = number of time, max =3 }
            game tip:{flag=gameTips} 0-on , 1-off
        +-------------------------------------------------------------------+ */
    logger.info("ChangeGameSetting----------------->>>>data: " + data);
    logger.info(
      "ChangeGameSetting----------------->>>>client.uid: " + client.uid
    );

    if (!data.flag) {
      logger.info('ChangeGameSetting---------------->>>>"flag not found"');
      return;
    }
    getInfo.GetUserInfo(client.uid, { flags: 1 }, function (userInfo) {
      let check = false;
      let sts = 1;
      if (userInfo) {
        let upData = {};
        if (data.flag == "sound" || data.flag == "vibrate") {
          if (data.flag == "sound") {
            // if(userInfo.flags._snd == 1){
            upData = { $set: { "flags._snd": data.sts } };
            sts = data.sts;
            // }
            // else{
            //     upData = {$set:{'flags._snd':1}};
            //     sts = 1;
            // }
            check = true;
          } else if (data.flag == "vibrate") {
            // if(userInfo.flags._vib == 1){
            upData = { $set: { "flags._vib": data.sts } };
            sts = data.sts;
            // }
            // else{
            //     upData = {$set:{'flags._vib':1}};
            //     sts = 1;
            // }
            check = true;
          }
          if (!check) {
            logger.info('ChangeGameSetting---------------->>>>>"check fails"');
            return;
          }
          getInfo.UpdateUserData(client.uid, upData, function (upInfo) {
            if (upInfo) {
              commonClass.SendData(client, "ChangeGameSetting", {
                flag: data.flag,
                sts: sts,
              });
            }
          });
        } else if (
          data.flag == "Pool" ||
          data.flag == "Points" ||
          data.flag == "Deal"
        ) {
          logger.info(`change move---${data.flag}-----`);
          getInfo.GetTbInfo(data.tbId, {}, function (table) {
            if (!table) {
              logger.info(
                'ChangeGameSetting----------->>>>>>Error:"table not found"'
              );
              return false;
            }

            if (table.gt == data.flag) {
              db.collection("playing_table").findOneAndUpdate(
                { "pi.uid": client.uid },
                {
                  $set: {
                    "pi.$.maxUserTimeout": data.sts,
                  },
                },
                { new: true },
                function (err, resp) {
                  if (resp) {
                    commonClass.SendData(client, "ChangeGameSetting", {
                      flag: data.flag,
                      sts: sts,
                    });
                  } else {
                    logger.info("error=========>", err);
                  }
                }
              );
            } else {
              return false;
            }
          });
        } else if (data.flag == "gameTips") {
          upData = { $set: { "flags._tips": data.sts } };
          sts = data.sts;
          getInfo.UpdateUserData(client.uid, upData, function (upInfo) {
            if (upInfo) {
              commonClass.SendData(client, "ChangeGameSetting", {
                flag: data.flag,
                sts: sts,
              });
            }
          });
        }
      } else {
        logger.info('ChangeGameSetting---------------->>>>"user not found!!!"');
      }
    });
  } catch (error) {
    logger.error("-----> error ChangeGameSetting", error);
    getInfo.exceptionError(error);
  }
};

const GameSetting = (data, client) => {
  try {
    logger.info("GameSetting-------->>>client.uid: ", client.uid);

    getInfo.GetUserInfo(
      /* data.uid */
      /* update */ client.uid,
      { counters: 1, flags: 1 },
      function (userInfo) {
        //get the current userInfo
        if (userInfo) {
          var obj = {
            vib: userInfo.flags._vib,
            snd: userInfo.flags._snd,
            points: userInfo.flags._pointTimeout,
            pool: userInfo.flags._poolTimeout,
            deal: userInfo.flags._dealTimeout,
            gameTips: userInfo.flags._tips,
          };
          commonClass.SendData(client, "GameSetting", obj);
        } else {
          logger.info('GameSetting--------------------->>>>>>"user not found"');
        }
      }
    );
  } catch (error) {
    logger.error("-----> error GameSetting", error);
    getInfo.exceptionError(error);
  }
};

const ManageUserLevel = async (en, data) => {
  try {
    return new Promise((resolve, reject) => {
      var xp = 0;
      db.collection("event_points").findOne({ en: en }, function (err, res) {
        if (res) {
          logger.info('ManageUserLevel--------------------->>>>>>"res"', res);
          var levelup = false;
          if (res.levelUp == true) {
            levelup = true;
          } else {
            xp = res.xp;
          }
          //if user eligible for increase the level progress
          if (xp > 0 || levelup == true) {
            data =
              data != null && typeof data != "undefined" ? data.toString() : "";
            var uid = data.toString();
            logger.info('ManageUserLevel--------------------->>>>>>"uid"', uid);
            //first we have to collect userinformation to complete the level.
            getInfo.GetUserInfo(
              uid,
              { counters: 1, sck: 1, flags: 1, Chips: 1, club: 1 },
              function (ui) {
                if (ui) {
                  logger.info(
                    'ManageUserLevel--------------------->>>>>>"ui"',
                    ui
                  );
                  db.collection("level_points").findOne(
                    { lvc: ui.counters.lvc + 1 },
                    function (err, points) {
                      if (points) {
                        logger.info(
                          'ManageUserLevel--------------------->>>>>>"points"',
                          points
                        );
                        var levelPoint = points.pts;
                        var lup = false;

                        if (levelup == true) {
                          xp = levelPoint - ui.counters.ppo;
                        }
                        // var levelPoint = ((ui.counters.lvc * 50) + 20); //generate point range according to level
                        var npp = parseInt(ui.counters.ppo) + xp;
                        var np = parseInt(ui.counters.ppo) + xp; //prepare new point after summation
                        if (levelPoint <= np || levelup == true) {
                          lup = true;
                        }
                        var lc =
                          levelPoint <= np || levelup == true
                            ? ui.counters.lvc + 1
                            : ui.counters.lvc; //if level point smaller or equal then change the level
                        np = levelPoint <= np ? np - levelPoint : np; //if level point smaller or equal then change the level
                        // levelPoint = (ui.counters.lvc < lc) ? ((lc * 50) + 20) : levelPoint;
                        levelPoint = ui.counters.lvc < lc ? 100 : levelPoint;

                        //percentage for level completed
                        var pp = Math.round((100 * np) / levelPoint);
                        var update = {
                          $set: {
                            "counters.lvc": lc,
                            "counters.pper": pp,
                            "counters.ppo": npp,
                          },
                        };

                        db.collection("game_users").updateOne(
                          { _id: getInfo.MongoID(uid) },
                          update,
                          async function () {
                            ManageUserClub(data);
                            var dt = {
                              en: en,
                              club: ui.club,
                              lvc: lc,
                              pper: pp,
                              ppo: npp,
                            };

                            commonClass.SendDirect(ui.sck, {
                              en: "UUL",
                              data: dt,
                            });

                            if (lup == true) {
                              var resp = await ManageUserLevel(
                                "level bonus",
                                uid
                              );
                            }

                            resolve(true);
                          }
                        );
                      } else {
                        resolve(true);
                      }
                    }
                  );
                }
              }
            );
          } else {
            resolve(true);
          }
        } else {
          resolve(true);
        }
      });
    });
  } catch (error) {
    logger.error("-----> error ManageUserLevel", error);
    getInfo.exceptionError(error);
  }
};
const ManageUserClub = (uid) => {
  try {
    if (typeof uid == "undefined" || uid.toString().length < 24) {
      return false;
    }

    getInfo.GetUserInfo(uid.toString(), {}, function (uinfo) {
      if (typeof uinfo._id != "undefined") {
        logger.info("ManageUserClub------------>>>>>>>>uinfo", uinfo);
        db.collection("level_manager")
          .find({})
          .sort({ slvl: 1 })
          .toArray(function (err, resp) {
            if (resp.length > 0) {
              var club = resp;
              var old_club = uinfo.club;
              var vip_club = uinfo.club;
              var rewards = 0;
              var benefits = {
                tournament: uinfo.unlock.tournament,
                playwithfriend: uinfo.unlock.playwithfriend,
              };
              for (var i = 0; i < club.length; i++) {
                if (
                  uinfo.counters.lvc >= club[i].slvl &&
                  uinfo.counters.lvc <= club[i].elvl
                ) {
                  vip_club = club[i].name;
                  benefits = club[i].benefits;
                  rewards = club[i].rewards;
                  break;
                }
              }

              var update = { $set: { club: vip_club, unlock: benefits } };
              if (old_club != vip_club) {
                update.$set["claimRewards"] = 0;
              }

              db.collection("game_users").updateOne(
                { _id: getInfo.MongoID(uinfo._id) },
                update,
                function () {
                  if (old_club != vip_club) {
                    var club_counter = 1;
                    if (
                      vip_club == "Bronze-I" ||
                      vip_club == "Silver-I" ||
                      vip_club == "Gold-I" ||
                      vip_club == "Platinum-I"
                    ) {
                      club_counter = 1;
                    } else if (
                      vip_club == "Bronze-II" ||
                      vip_club == "Silver-II" ||
                      vip_club == "Gold-II" ||
                      vip_club == "Platinum-II"
                    ) {
                      club_counter = 2;
                    } else if (
                      vip_club == "Bronze-III" ||
                      vip_club == "Silver-III" ||
                      vip_club == "Gold-III" ||
                      vip_club == "Platinum-III"
                    ) {
                      club_counter = 3;
                    }

                    if (
                      vip_club == "Bronze-I" ||
                      vip_club == "Bronze-II" ||
                      vip_club == "Bronze-III"
                    ) {
                      old_club = "Bronze";
                      club = "Bronze";
                    } else if (
                      vip_club == "Silver-I" ||
                      vip_club == "Silver-II" ||
                      vip_club == "Silver-III"
                    ) {
                      old_club = "Bronze";
                      club = "Silver";
                    } else if (
                      vip_club == "Gold-I" ||
                      vip_club == "Gold-II" ||
                      vip_club == "Gold-III"
                    ) {
                      old_club = "Silver";
                      club = "Gold";
                    } else if (
                      vip_club == "Platinum-I" ||
                      vip_club == "Platinum-II" ||
                      vip_club == "Platinum-III"
                    ) {
                      old_club = "Gold";
                      club = "Platinum";
                    }

                    var dt = {
                      uid: uinfo._id.toString(),
                      claim: 0,
                      rewards: rewards,
                      old_club: old_club,
                      club_name: club,
                      club: vip_club,
                      club_counter: club_counter,
                      lvc: uinfo.counters.lvc,
                      ppo: uinfo.counters.ppo,
                      pper: uinfo.counters.pper,
                    };

                    db.collection("claim_rewards").insertOne(
                      dt,
                      function (err, trackdata) {
                        if (!err && typeof trackdata.ops[0] != "undefined") {
                          ManageUserLevel("club bonus", uinfo._id);
                          commonClass.SendDirect(uinfo.sck, {
                            en: "PRGU",
                            data: dt,
                          });
                        }
                      }
                    );
                  } else {
                    logger.info(
                      "ManageUserClub-------------->>>>>>>>>> :club not updated"
                    );
                  }
                }
              );
            }
          });
      }
    });
  } catch (error) {
    logger.error("-----> error ManageUserClub", error);
    getInfo.exceptionError(error);
  }
};

module.exports = { ChangeGameSetting, GameSetting, ManageUserLevel };
