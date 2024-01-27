const jwt = require("jsonwebtoken");
const { increment } = require("./redis.class");
const {
  getRandomId,
  convertUsername,
  getYearMonthRandomId,
} = require("../utils");
const expireBonus = require("../utils/expireBonus");
const getLocations = require("../utils/getLocations");
const commonClass = require("./common.class");
const trackClass = require("./track.class");
const dashboardClass = require("./dashboard.class");
const getInfo = require("../common");
const logger = require("../utils/logger");
const { GetConfig } = require("../connections/mongodb");
const { timeout } = require("../utils");

const SignUp = async (data, client) => {
  // await timeout(5000)
  //Signup data = {}
  /* +-------------------------------------------------------------------+
        desc:main signup event
        i/p: data = {
                DeviceId = device id
                SerialNumber = serial number for push notification
                un = username
                det  = device type
                iv = ios version
                av = android version
                ipad = ip address
                osType = os type
                osVer = os version
                devBrn = device brand
                devMdl = device model
                giftCode = giftcode for user
                ult = user login type
              }
          client = socket object
      +-------------------------------------------------------------------+ */

  try {
    if (!data.token) {
      return commonClass.SendData(
        client,
        "PopUp",
        { flag: "SignUp", token: "Invalid Token", err: true },
        "error:1062"
      );
    }

    //check for new version update popup
    if (
      ((data.version === "1.1" || data.version === "1.2") && !data.storeUser) ||
      (data.version === "1.1" && data.storeUser)
    )
      commonClass.SendData(
        client,
        "PopUp",
        {
          tokenExpired: {
            tokenExpiredflag: true,
          },
          flag: "SignUp",
          invalid: "invalid",
          err: true,
        },
        "error:1011"
      );

    const validUser = await authenticateJWT(data.token, client);

    if (!validUser) return false;
    const userDetail = await db
      .collection("game_users")
      .countDocuments({ _id: getInfo.MongoID(validUser.userId) });

    if (userDetail === 0) {
      return commonClass.SendData(
        client,
        "PopUp",
        {
          tokenExpired: {
            tokenExpiredflag: true,
          },
          flag: "SignUp",
          invalid: "invalid",
          err: true,
        },
        "error:1063"
      );
    }

    await expireBonus(validUser.userId);

    data.DeviceId = typeof data.DeviceId != "undefined" ? data.DeviceId : "";
    data.ip = typeof data.ip != "undefined" ? data.ip : "";

    const blockDevice = await db.collection("blocks_device").findOne({});
    const blockIp = await db.collection("blocks_ip").findOne({});
    if (
      commonClass.InArray(data.DeviceId, blockDevice.device_id) ||
      commonClass.InArray(data.ip, blockIp.ip_address)
    ) {
      commonClass.SendData(
        client,
        "PopUp",
        { flag: "SignUp", block: "device", err: true },
        "error:1005"
      );
      logger.info("GuestSignup----->>>>user is suspended");
      return false;
    }

    increment("totalOnlinePlayers");

    logger.info("SignUp---------->>>>guest------>>>>>sck: " + client.sck);
    GuestSignup(data, client);
  } catch (error) {
    logger.error("-----> error SignUp", error);
    getInfo.exceptionError(error);
  }
};

const GetGameConfig = (data, client) => {
  try {
    //get game config
    /* +-------------------------------------------------------------------+
        desc:event to get game config
        i/p: data = {},client = socket object
      +-------------------------------------------------------------------+ */
    let cnf = commonClass.GetGameConfig();

    commonClass.SendDirect(client.sck, { en: "GetGameConfig", data: cnf });
  } catch (error) {
    logger.error("-----> error GetGameConfig", error);
    getInfo.exceptionError(error);
  }
};

const getUserDefaultFieldsNew = async (data, client) => {
  try {
    //generates the user default fields for the game
    logger.info("getUserDefaultFields------------->>>>data: ");
    let dids = [];
    let ldi = "";
    const {
      MAX_TIMEOUT,
      BUCKET_URL,
      INITIAL_CHIPS,
      EXPIRE_SIGN_UP_BONUS,
      DEPOSIT_CASH,
      BONUS_SIGN_UP,
    } = GetConfig();
    if (
      typeof data.DeviceId != "undefined" &&
      data.DeviceId != null &&
      data.DeviceId != ""
    ) {
      dids.push(data.DeviceId);
      ldi = data.DeviceId;
    }

    let pp = BUCKET_URL + "prithvi_rummy/4.png";

    const userAvatar = await db
      .collection("user_avatar")
      .aggregate([{ $match: { use: true } }, { $sample: { size: 1 } }])
      .toArray();

    if (userAvatar.length) {
      pp = userAvatar[0].user_avatar;
    }

    let un = "";
    if (!data.un || data.un == "") {
      if (typeof data.ue != "undefined" && data.ue != "") {
        un = data.ue.split("@")[0];
      }
    } else {
      un = data.un;
    }

    return {
      // _id: await getRandomId(),
      un: un == "" ? await convertUsername(data.MobileNumber) : un,
      unique_id: await getYearMonthRandomId(6, "game_users", "unique_id"), //user uniqueID
      ue: data.email ? data.email : "", //useremail
      phn: data.MobileNumber ? data.MobileNumber : "", //phone no.
      tId: data.ID ? data.ID : "",
      // Password : (data.Password) ? data.Password : '',
      state: data.state ? data.state : "",
      ip: data.ip ? data.ip : "", //ip
      publicIp: data.publicIp ? data.publicIp : "", //publicIp
      pp: pp, //profile picture,
      ult: data.ult, //user login type
      cd: new Date(), //create date
      SignUpBonusExpire: new Date(
        new Date().getTime() + EXPIRE_SIGN_UP_BONUS * 24 * 60 * 60 * 1000
      ),
      SignUpBonusStatus: "Active",
      det: data.det, //device type
      dids: dids, //(!data.DeviceId || data.DeviceId == "") ? [] : [data.DeviceId],  //device ids
      sn: data.SerialNumber ? [data.SerialNumber] : [], //serial numbe(only for ios)
      wc: 0, //chips for winner
      Chips: INITIAL_CHIPS, //user chips
      totalcash: 0,
      SignUpBonus: BONUS_SIGN_UP,
      depositCash: DEPOSIT_CASH,
      inviteBonus: 0,
      Unutilized: 0,
      Winning: 0,
      Bonus: 0,
      EmailVerify: false,
      MobileVerify: false,
      PanVerify: false,
      BankVerify: false,
      UpiVerify: false,
      IsBlock: false,
      counters: {
        hw: 0, //hands win
        hwc: 0, //hands win cash mode
        hl: 0, //hands lost
        hlc: 0, // hands lost cash
        hd: 0, //Hands dropped
        hdc: 0, //Hands drop cash
        cw: 0, //consecutive win
        cl: 0, //consecutive lose
        cdr: 0, //consecutive drop
        thp: 0, //Total Hands played
        hpc: 0, //Total hands play cash
        hp: 0, //10 hands play for level tracking
        winTrigger: 0, // wintrigger for robot logic
        loseStreak: 0, //loss counter for robot logic
        sc: 0, //standup counter
        wsp: 0, // win share popup counter
        thpcd: 0, //Total hands play counter in 1 day
        pprc: 0, //play point rummy counter in 1 day
        pplrc: 0, //play pool rummy counter in 1 day
        pdrc: 0, //play deal rummy counter in 1 day
        pbrc: 0, //play bet rummy counter in 1 day
        ptc: 0, //play turnament counter in 1 day
        hcl: INITIAL_CHIPS, //highest chip level
        mcw: 0, //Most Chips Won
        deal_c: 0, //deal mode help session counter
        pool_c: 0, //pool mode help session counter
        bet_c: 0, //bet mode help session counter
        lvc: 0, // level completed counter
        ppo: 0, // current level point
        pper: 0, //current level completed percentage
        opc: 0, //operation counter
        fdbk: 0, //feedback counter
        rpc: 0, //report a problem counter
        dbc: 0, //daily bonus counter for consecutive come
        invC: 0, //invite counters
        addcash: 0, //add cash counter
        tacd: 0, //add cash counter in day
        playDays: 0, //consicutive play days
        spinDays: 0, //spin days,
        rfc_c: 0,
      },
      iv: data.det == "ios" ? data.iv : 0, //ios app version
      ivc: data.det == "ios" ? data.verCode : 0, //ios app version code
      av: data.det == "android" ? data.av : 0, //android app version
      avc: data.det == "android" ? data.verCode : 0, //android app version code
      nwt: data.nwt ? data.nwt : "", //network
      lc: commonClass.GetLanguageCode(data.lc), //Language code
      rfc: commonClass.GetRandomString(6), //referral code generated by system on signup
      flags: {
        _ir: 0, //is robot
        _ftp: 1, //first Time playing
        _isup: 0, //is suspended
        _isbkip: 0, // block by ip
        _isbkdv: 0, // block by device
        _io: 1, //is Online
        _pyr: 0, //is payer : 0 / 1
        _noti: 0, //notification : 0 / 1
        _snd: 1, // sounds : 0 / 1
        _vib: 1, //vibration : 0 / 1
        _challenge: 1, //challange : 0 / 1
        _tutf: 1, //tutorial flag
        _winshare: 0, //win share popup
        _shareSpinner: 0, //share post spinner : o / 1
        _payer: 0, //is payer : 0 / 1
        _isSpc: 1, // is first time user
        _fPick: 0, //first pick
        _fDiscard: 0, //first discard
        _fActions: 0, //first actions(declare)
        _fSort: 0, //first sort
        _isRefered: 0, //is already refered user or not
        _isRated: 0,
        _firstdeposit: false,
        _poolTimeout: MAX_TIMEOUT,
        _pointTimeout: MAX_TIMEOUT,
        _dealTimeout: MAX_TIMEOUT,
        _usedRFCcode: false,
        _notificationCashFlag: true,
      },
      lasts: {
        pl: new Date(), //previous login
        ll: new Date(), //last login
        llgt: new Date(), // last logout
        lpt: new Date(), //last playing time
        lac: new Date(), //last add cash
        ldt: data.det, //last device type
        ldi: ldi, // last device id
        ls: new Date(),
        lwsp: new Date(), //last win share popup time
        lsn: data.SerialNumber ? data.SerialNumber : null, // last serial number
        ldbt: commonClass.subTime(86400), //last daily bonus time
        lsct: commonClass.subTime(86400), //last spin collect time
        lort: "", //last offer reject time
        lrtt: new Date(), // last retention time
        lltt: new Date(), // last login track time
        lrpt: commonClass.subTime(86400), //last rate popup showing time
      },
      unlock: {
        tournament: 0,
        playwithfriend: 1,
      },
      club: "Bronze-I",
      claimRewards: 1,
      cAmount: false,
      rlsAmount: false,
      tbd: "",
      rand: Math.random(), //random numer for special purposes
      tbid: "", //table id
      rejoinID: "", //rejoinId
      rejoin: 0, //rejoin flag
      cbtn: 1, //in game notification
      ds: data.ds ? data.ds : "", //download source
      ipad: client.ipad ? client.ipad : "", //ip address
      country: "India", //country of player (default India)
      cc: "in", //country code
      city: "", //city
      bv: 50, // boot value of table that last played by user
      sck: client.sck ? client.sck : "", //socket id of user
      sessId: 1, //Session Id
      osType: typeof data.osType != "undefined" ? data.osType : "", //os of device
      osVer: typeof data.osVer != "undefined" ? data.osVer : "", //os version
      devBrnd: typeof data.devBrnd != "undefined" ? data.devBrnd : "", //device brand
      devMdl: typeof data.devMdl != "undefined" ? data.devMdl : "", //device model
      rfl: "",
      offers: {
        ofId: "", //offer id
      }, //offer to show on low chips
      tdsDeposited: 0.0,//tds deposited on net winning
      withdrawnAmount: 0,//amount withdrawn by the user
    };
  } catch (error) {
    logger.error("-----> error getUserDefaultFieldsNew", error);
    getInfo.exceptionError(error);
  }
};
const GuestSignup = async (data, client) => {
  try {
    //handle signup operation of the guest player
    /* +-------------------------------------------------------------------+
      desc:function to handle guest signup
      i/p: data = {
          DeviceId = device id
          SerialNumber = serial number for push notification
          un = username
          det  = device type
          iv = ios version
          av = android version
          ipad = ip address
          osType = os type
          osVer = os version
          devBrn = device brand
          devMdl = device model
          giftCode = giftcode for user
        }
        client = socket object
    +-------------------------------------------------------------------+ */

    //guest signup with random username. on deviceId
    const res = await db.collection("game_users").findOne({ _id: getInfo.MongoID(data.userid) });
    //if user with this device key is already exist then we have return this user data.
    if (!res) {
      commonClass.SendData(
        client,
        "PopUp",
        { userNotExist: true },
        "error:1004"
      );
      return false;
    }
    client._isup = res.flags._isup;
    client.storeUser = data.storeUser == true ? true : false;
    if (res.flags._isup == 1) {
      commonClass.SendData(client, "PopUp", { suspended: true }, "error:1005");

      logger.info("GuestSignup----->>>>user is suspended");
      return false;
    }

    let upWhere = {
      $set: {
        det: data.det,
        ult: data.ult,
        deviceId: data.DeviceId ? data.DeviceId : data.dids,
        "lasts.pl": res.lasts.ll,
        "lasts.lsn": data.SerialNumber,
        "lasts.ldt": data.det,
        "flags._io": 1,
        "lasts.lsi": 0,
        "lasts.lltt": new Date(),
        storeUser: client.storeUser,
        publicIp: data.publicIp,
      },
    };
    upWhere.$set.nwt = data.nwt ? data.nwt : res.nwt;
    upWhere.$set.iv = data.iv ? data.iv : res.iv;
    upWhere.$set.av = data.av ? data.av : res.av;

    if (data.det == "android") {
      if (typeof data.verCode != "undefined" && data.verCode != null) {
        upWhere.$set.avc = data.verCode;
      } else if (typeof res.avc != "undefined" && res.avc != null) {
        upWhere.$set.avc = res.avc;
      } else {
        upWhere.$set.avc = 0;
      }
    } else if (data.det == "ios") {
      if (typeof data.verCode != "undefined" && data.verCode != null) {
        upWhere.$set.ivc = data.verCode;
      } else if (typeof res.ivc != "undefined" && res.ivc != null) {
        upWhere.$set.ivc = res.ivc;
      } else {
        upWhere.$set.ivc = 0;
      }
    }

    let diff = 60;
    if (res.lasts.llgt) {
      logger.info(
        "GuestSignup---------------->>>>>res.lasts.llgt: " + res.lasts.llgt
      );
      diff = commonClass.GetTimeDifference(res.lasts.llgt, new Date());
    }

    if (diff > 60 && res.flags._io == 0) {
      //means time greater than 60 second = 1 min then update session
      upWhere.$set["lasts.ll"] = new Date();
      upWhere.$set["counters.opc"] = 0;
      upWhere.$inc = { sessId: 1 };
    }

    upWhere.$set.deviceName = data.deviceName ? data.deviceName : "";
    upWhere.$set.version = data.version ? data.version : "";
    upWhere.$set.ip = data.ip ? data.ip : "";
    upWhere.$set.latitude = data.latitude ? data.latitude : "";
    upWhere.$set.longitude = data.longitude ? data.longitude : "";

    // if (!res.scriptUser) {
    //         userLocation = await getLocations({
    //           latitude: data.latitude,
    //           longitude: data.longitude,
    //         });
      
    // }
    

    //check the location is change or null from request
    var locationData1={}
    console.log(typeof(res.longitude))
    if(data.longitude != '0' && !res?.scriptUser){
      if(res.longitude){
        if(res.longitude =='0'){
          console.log("++++++++++++++++++++++++Location Hit API++++++++++++++++++++++++++++++")
          const { locationData } = await getLocations({
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
          });
          locationData1 = locationData
        }
        else if(res.longitude !='0' && res.longitude != data.longitude){
          console.log("++++++++++++++++++++++++Location Hit API++++++++++++++++++++++++++++++")
          const { locationData } = await getLocations({
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
          });
          locationData1 = locationData
        }
        else{
          locationData1.city = res.city
          locationData1.principalSubdivision = res.state||''
          locationData1.countryName = res.country
          locationData1.longitude = res.longitude||''
          locationData1.latitude = res.latitude||''
          data.latitude = res.latitude || ''
          data.longitude = res.longitude || ''
        }
      }
      else{
        console.log("++++++++++++++++++++++++Location Hit API++++++++++++++++++++++++++++++")
          const { locationData } = await getLocations({
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
          });
          locationData1 = locationData
      }
    }
    else{
      locationData1.city = res.city
      locationData1.principalSubdivision = res.state||''
      locationData1.countryName = res.country
      locationData1.longitude = res.longitude||''
      locationData1.latitude = res.latitude||''
      data.latitude = res.latitude || ''
      data.longitude = res.longitude || ''
    }
    // const { locationData } = await getLocations({
    //   latitude: data.latitude,
    //   longitude: data.longitude,
    // });

    upWhere.$set.city = locationData1.city ? locationData1.city : "";
    upWhere.$set.state = locationData1.principalSubdivision
      ? locationData1.principalSubdivision
      : "";
    upWhere.$set.country = locationData1.countryName
      ? locationData1.countryName
      : "";

    upWhere.$set.ipad = client.ipad ? client.ipad : "";
    upWhere.$set.osType =
      typeof data.osType != "undefined" ? data.osType : res.osType;
    upWhere.$set.osVer =
      typeof data.osVer != "undefined" ? data.osVer : res.osVer;
    upWhere.$set.devBrnd =
      typeof data.devBrnd != "undefined" ? data.devBrnd : res.devBrnd;
    upWhere.$set.devMdl =
      typeof data.devMdl != "undefined" ? data.devMdl : res.devMdl;

    client.isAlreadyLogin = true;
    client.longitude = locationData1.longitude;
    client.latitude = locationData1.latitude;
    client.city = locationData1.city;
    client.state = locationData1.principalSubdivision;

    if (data.DeviceId && data.DeviceId != "") {
      if (!commonClass.InArray(data.DeviceId, res.dids)) {
        upWhere.$addToSet = { dids: data.DeviceId };
        //  upWhere.$push.dids = upWhere.$push.dids.filter(
        //   (v, i, a) => a.indexOf(v) === i
        // );
      }

      if (res.lasts.ldi === data.DeviceId) {
        upWhere.$set["lasts.ldi"] = data.DeviceId;
        client.isAlreadyLogin = false;
      }
    }

    if (
      data.SerialNumber &&
      data.SerialNumber != "" &&
      !commonClass.InArray(data.SerialNumber, res.sn)
    ) {
      upWhere.$push = { sn: data.SerialNumber };
    }

    if (!res.unique_id)
      upWhere.$set.unique_id = "PR" + commonClass.GetRandomInt(1, 99999999);

    if (res.tbid != "" || res.tableRemove) {
      //means user is reconnect after 1 min  so
      let findId = {};
      if (res.tbid) {
        findId = { _id: getInfo.MongoID(res.tbid) };
      }
      db.collection("playing_table").findOne(
        {
          ...findId,
          $or: [
            { "pi.uid": res._id.toString() },
            { "stdP.uid": res._id.toString() },
          ],
        },
        function (err, table) {
          if (table) {
            if (res.rejoin == 0) {
              //special condition for rejoin before disconnect

              client.tbid = table._id.toString();
              client.gt = table.gt;

              upWhere.$set.rejoin = 1; //means direct rejoin
            } else if (res.rejoin == 2) {
              client.tbid = table._id.toString();
              client.gt = table.gt;

              if (table.ap == table.ms) {
                //means table is full and user is not playing as rejoin = 2
                upWhere.$set.rejoin = 3; ///rejoin = 3 means we have to show only switch table option
              }
            }
          } else {
            upWhere.$set.tbid = "";
            upWhere.$set.rejoin = 1;
            upWhere.$set.rejoinID = "";
          }

          getInfo.UpdateUserData(res._id.toString(), upWhere, function (resp2) {
            if (resp2) {
              if (data.giftCode != "") {
                //gift code storing
                resp2.giftCode = data.giftCode;
              }

              trackClass.TrackReferrer(
                data,
                resp2,
                false,
                function (userData1) {
                  dashboardClass.AUCI(resp2, client);
                }
              );
            } else {
              logger.info(
                'GuestSignup::::::::::::::::::::::::::>>>>Error: "user not found"'
              );
            }
          });
        }
      );
    } else {
      upWhere.$set.tbid = "";
      upWhere.$set.rejoin = 0;
      upWhere.$set.rejoinID = "";

      getInfo.UpdateUserData(res._id.toString(), upWhere, function (resp2) {
        if (resp2) {
          if (data.giftCode != "") {
            //gift code storing
            resp2.giftCode = data.giftCode;
          }

          trackClass.TrackReferrer(data, resp2, false, function (userData1) {
            dashboardClass.AUCI(resp2, client);
          });
        } else {
          logger.info(
            'GuestSignup:::::::::::::::::>>>>Error: "user not found"'
          );
        }
      });
    }
  } catch (error) {
    logger.error("-----> error GuestSignup", error);
    getInfo.exceptionError(error);
  }
};

const GetUserProfile = async (data, client) => {
  try {
    logger.info("userId------------->", client.uid);
    if (!client.uid) {
      return commonClass.SendData(
        client,
        "PopUp",
        { flag: "GetUserProfile", err: true },
        "error:1004"
      );
    }
    const res = await db
      .collection("game_users")
      .findOne({ _id: getInfo.MongoID(client.uid) });
    // logger.info("GuestSignup-----------res:", res);
    if (!res) {
      commonClass.SendData(
        client,
        "PopUp",
        { userNotExist: true },
        "error:1004"
      );
      return false;
    }

    let totalBonus,
      SignUpBonus = 0,
      totalCashBonus = 0,
      totalReferralBonus = 0,
      cmsBonus = 0;

    if (res.SignUpBonusStatus == "Active") {
      SignUpBonus += res.SignUpBonus;
    }

    if (res.addCash_bonus) {
      for (const element of res.addCash_bonus) {
        if (element.status == "Active") {
          totalCashBonus += element.addCashBonus;
        }
      }
    }
    logger.info("totalCashBonus----------->", totalCashBonus);

    if (res.referral_bonus) {
      for (const element of res.referral_bonus) {
        if (element.status == "Active") {
          totalReferralBonus += element.referralBonus;
        }
      }
    }
    logger.info("totalReferralBonus----------->", totalReferralBonus);

    if (res.Bonus) {
      cmsBonus += res.Bonus;
    }

    totalBonus = totalCashBonus + SignUpBonus + totalReferralBonus + cmsBonus;
    if (totalBonus < 0) {
      totalBonus = 0;
    }
    logger.info("totalBonus----------->", totalBonus);

    const returnData = {
      _id: res._id,
      un: res.un,
      phn: res.phn,
      pp: res.pp,
      Chips: res.Chips,
      totalcash: res.depositCash + res.Winning,
      SignUpBonus: SignUpBonus,
      totalBonus: totalBonus,
    };
    commonClass.SendData(client, "GetUserProfile", returnData);
  } catch (error) {
    logger.error("-----> error GetUserProfile", error);
    getInfo.exceptionError(error);
  }
};
const authenticateJWT = async (token, client) => {
  try {
    if (!token) {
      return commonClass.SendData(
        client,
        "PopUp",
        { flag: "SignUp", token: "Invalid Token", err: true },
        "error:1062"
      );
    }

    return jwt.verify(token, process.env.JwtSecretKey, function (err, decoded) {
      if (err) {
        console.error("err: ", err);
        return commonClass.SendData(
          client,
          "PopUp",
          { flag: "SignUp", token: "Authorization Token Expired", err: true },
          "error:1061"
        );
      }
      logger.info("Token verifified successfully");
      return decoded;
    });
  } catch (error) {
    return commonClass.SendData(
      client,
      "PopUp",
      { flag: "SignUp", token: "Invalid Token", err: true },
      "error:1062"
    );
  }
};

module.exports = {
  SignUp,
  GetGameConfig,
  GetUserProfile,
  getUserDefaultFieldsNew,
};
