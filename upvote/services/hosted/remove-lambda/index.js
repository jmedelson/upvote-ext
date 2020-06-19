const AWS = require('aws-sdk');
const documentClient = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });
const jwt = require('jsonwebtoken');
const axios = require('axios');

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

const updateDB = async (channelId, postid) => {
    console.log("params",channelId,postid)
    const params = {
      TableName: 'upvote-db',
      Key: {
          "channel": channelId,
          "uid": postid
      },
      UpdateExpression: 'set #a = #a + :y',
      ExpressionAttributeNames: {'#a' : 'upvotes'},
      ExpressionAttributeValues: {
        ':y' : 1
      },
      ReturnValues: "ALL_NEW"
    };
    return await documentClient.update(params).promise();
  }
  
  const sendBroadcast = async (channel, data) =>{
      const link = `https://api.twitch.tv/extensions/message/` + channel
      const bearerPrefix = 'Bearer ';
      const request = {
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
  
  const voteHandler = async(channelId, data) =>{
    var postid = data.split('=')[1]
    var res = await updateDB(channelId, postid)
    console.log("db done")
    var message = {
      data:{
        uid: postid,
        post: res.Attributes.post,
        poster: res.Attributes.poster,
        votes: res.Attributes.upvotes,
        identifier: 'newVote'
      }
    }
    console.log("MESSAGE", message)
    await sendBroadcast(channelId, JSON.stringify(message))
    return true;
  }
  exports.handler = async event => {
      // Response function
      const response = (statusCode, body) => {
        const headers = {
          ['Access-Control-Allow-Origin']: event.headers.origin,
          ["Access-Control-Allow-Credentials"] : true
        };
    
        return { statusCode, body: JSON.stringify(body, null, 2), headers };
      };
      const payload = verifyAndDecode(event.headers.Authorization);
      const channelId = payload.channel_id;
      const data = event['body'];
      console.log(data);
      var res = await voteHandler(channelId, data)
      return response(200, 'message--sucess');
  };