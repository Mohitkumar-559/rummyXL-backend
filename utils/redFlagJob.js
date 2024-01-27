const { GetConfig,TableHistory } = require("../connections/mongodb");
const getInfo = require("../common");
const logger = require("./logger");
const redFlagData = async ({ eventName, tableId, tableData, userIndex })=>{
    try {
      const { MAX_INVALID_DECLARE } = GetConfig();
      logger.info("update working in red flag user");
      /* +---------------------------------------------------------------
         flag player indentifacition and updating the data in user details 
         game_user DB
      --------------------------------------------------------------------*/
      const playerList = tableData.pi;
      /******** implement of red flag user*********** */
      const play = playerList.map(player => { return player.tScore;});
      const max = Math.max(...play);

      //get the winner and losser id
        let winPlay = playerList.filter((element)=>{ if(element.tScore ==max ){return element;}});
        let lsPlay = playerList.filter((element)=>{ if(element.tScore !=max ){return element;}});
        let losserPlayer = lsPlay[0]
        let winnerPlayer = winPlay[0]
        
      if(eventName=="DropCards"){
        let getOppenentIndex
        //check cardpicked  by opponnet or not
        getOppenentIndex = (userIndex + 1) % (playerList.length);
        //losser will be 
        losserPlayer = playerList[userIndex];
        winnerPlayer = playerList[getOppenentIndex];
      }
      if(eventName=="LeaveTable"){
        let getOppenentIndex
        //check cardpicked  by opponnet or not
        getOppenentIndex = (userIndex + 1) % (playerList.length);
        //losser will be 
        losserPlayer = tableData.hist[0];
        winnerPlayer = playerList[getOppenentIndex];
      }
      if(eventName=="WinnerDeclared"){
        let getOppenentIndex
        //check cardpicked  by opponnet or not
        getOppenentIndex = (userIndex + 1) % (playerList.length);
        //losser will be 
        losserPlayer = playerList[getOppenentIndex];
        winnerPlayer = playerList[userIndex];
      }
        
          const findRedFlag = await db.collection("Fake_Winner").findOneAndUpdate({ winner_userId: winnerPlayer.uid },{ $push: {losser_userId: losserPlayer.uid,tableId:tableData._id.toString(),roundId:tableData.round,game_mode:tableData.gt},$inc: { count : 1 }},{
            returnNewDocument: true
          });
          if(eventName=="invalidDeclare"||eventName=="DropCards"||eventName=="LeaveTable"){
            //check fake_winner table player is avilable
            
            if(!findRedFlag.value){
              //adding red flag uses in db
              let RedFlagUserAdd = await db.collection("Fake_Winner").insertOne({ winner_userId: winnerPlayer.uid ,losser_userId: [losserPlayer.uid],tableId:[tableData._id.toString()], roundId:[tableData.round],game_mode : [tableData.gt],count:1,numberOfRed:0 } );
            }
            else{
              if(findRedFlag.value.count>=MAX_INVALID_DECLARE-1){
                //add red flag to user
                const addRedFlag = await db.collection("game_users").updateOne({unique_id: winnerPlayer.unique_id},{$set:{redFlag:true}})
                const RedFlagcounter = await db.collection("Fake_Winner").findOneAndUpdate({ winner_userId: winnerPlayer.uid },{$set:{count:0},$inc: { numberOfRed : 1}},{
                  returnNewDocument: true
                });
              }
            }
            
            
            
          }
          else{
            //removing the redflag
            //const deleteRedFlag = await db.collection("Fake_Winner").remove({ winner_userId: winnerPlayer.userId.toString() })
            //remove last entery beacuse there is no three consiqutive winner by invalid declaration.
            if(findRedFlag.value){
              if(findRedFlag.value.count==2)
              {
                const popdetails1 = await db.collection("Fake_Winner").findOneAndUpdate({ winner_userId: winnerPlayer.uid },{ $pop: {losser_userId: 1,tableId:1,roundId:1,game_mode:1},$set: { count : 0 }},{
                  returnNewDocument: true
                });
                const popdetails2 = await db.collection("Fake_Winner").findOneAndUpdate({ winner_userId: winnerPlayer.uid },{ $pop: {losser_userId: 1,tableId:1,roundId:1,game_mode:1},$set: { count : 0 }},{
                  returnNewDocument: true
                });
              }
              else{
                const popdetails2 = await db.collection("Fake_Winner").findOneAndUpdate({ winner_userId: winnerPlayer.uid },{ $pop: {losser_userId: 1,tableId:1,roundId:1,game_mode:1},$set: { count : 0 }},{
                  returnNewDocument: true
                });
              }
              
              
            }
            
          }
  
      /* ---------------------Code End----------------------------------- */
        
      
  
  
    } catch (error) {
      logger.error("-----> error red flag function", error);
      getInfo.exceptionError(error);
    }
  }
  module.exports = {
    redFlagData
  }