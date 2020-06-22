const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const jwt = require('jsonwebtoken');
const axios = require('axios');
var earlyExit = false

//jwt authenticator
const verifyAndDecode = (auth) => {
    const bearerPrefix = 'Bearer ';
    if (!auth.startsWith(bearerPrefix)) return { err: 'Invalid authorization header' };
    try {
      const token = auth.substring(bearerPrefix.length);
      const secret = process.env.secret;
      return jwt.verify(token, Buffer.from(secret, 'base64'), { algorithms: ['HS256'] });
    } catch (err) {
      return { err: 'Invalid JWT' };
    }
}

//creates token for twitch pubsub broadcasting
const makeServerToken = channelID => {
    const serverTokenDurationSec = 30;
  
    const payload = {
      exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
      channel_id: channelID,
      user_id: process.env.ownerId,
      role: 'external',
      pubsub_perms: {
        send: ["broadcast"],
      },
    };
    
    const secret = Buffer.from(process.env.secret, 'base64');
    return jwt.sign(payload, secret, { algorithm: 'HS256' });
};

//queries db for post linked to broadcast channel, stores in array to be deleted
const clearDB = async (channelId) => {
  console.log("params",channelId)
  var params = {
    TableName: 'upvote-db',
    Key: {
        "channel": channelId
    },
    KeyConditionExpression: 'channel = :channel',
    ExpressionAttributeValues: {
        ':channel': channelId
    },
    ProjectionExpression: "channel, uid"
  };
  var chData = await documentClient.query(params).promise();
  var data = chData.Items
  console.log(data)
  return data;
}
//Batch writes db with posts to be deleted
const removeQuery = async (data) => {
  var items = [] //posts stored here
  for(var i = 0; i<data.length; i++){
    //tells db to delete each item
    items[i] = {
      DeleteRequest : { Key: data[i]}
    }
  }
  //batch write can handle a max of 25 items per request
  for(var j = 0; j<items.length; j = j +25){
    var endpoint = 0
    if(j + 24 < items.length){
      endpoint = j+25
    }else{
      endpoint = items.length 
    }
    var params = {
      RequestItems:{
        'upvote-db': items.slice(j,endpoint)
      },
      ReturnConsumedCapacity: 'TOTAL',
      ReturnItemCollectionMetrics: 'SIZE'
    };
    console.log('params', j , endpoint);
    await documentClient.batchWrite(params).promise();
  }
  return 'done'
  
}
//broadcast to twitch pubsub
const sendBroadcast = async (channel, data) =>{
    var link = `https://api.twitch.tv/extensions/message/` + channel
    var bearerPrefix = 'Bearer ';
    var request = {
        method: 'POST',
        url: link,
        headers : {
            'Client-ID': process.env.clientId,
            'Content-Type': 'application/json',
            'Authorization': bearerPrefix + makeServerToken(channel),
        },
        data : JSON.stringify({
          content_type: 'application/json',
          message: data,
          targets: ['broadcast']
        })
    }
    return await axios(request)
}

//main handle for reseting upvotes for a channel
const resetHandler = async(channelId) =>{
  var check = true
  
  while(check){
    var res = await clearDB(channelId)
    //if query detects db is empty broadcast success
    if(res.length == 0){
      console.log("EMPTY-0000")
      check = false
      var message = {
        data:{
          identifier: 'resetComplete'
        }
      }
      await sendBroadcast(channelId, JSON.stringify(message))
      break;
    }
    await removeQuery(res)
  }
  
}
exports.handler = async (event, context, callback) => {
    // // Response function
    const response = (statusCode, body) => {
      const headers = {
        // ['Access-Control-Allow-Origin']: '*',
        ['Access-Control-Allow-Origin']: event.headers.origin,
        ["Access-Control-Allow-Credentials"] : true
      };
      console.log("responding", body)
      return { statusCode, body: JSON.stringify(body, null, 2), headers };
    };
    const payload = verifyAndDecode(event.headers.Authorization);
    const channelId = payload.channel_id;
    //Emergency timeout send broadcast over pubsub if function will not finish in time
    setTimeout(function() {
      var message = {
        data:{
          identifier: 'resetNotDone'
        }
      }
      sendBroadcast(channelId, JSON.stringify(message))
    }, 8000);
    var data = event['body'];
    //contains if reset has already begone and initial message has been broadcast
    data = data.split('=')[1]
    if(data=='false'){
      var message = {
        data:{
          identifier: 'resetStart'
        }
      }
      await sendBroadcast(channelId, JSON.stringify(message))
    }
    await resetHandler(channelId)
    // var res = await resetHandler('123451')
    
    return response(200, 'update block')
    
};