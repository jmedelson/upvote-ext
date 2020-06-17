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
};

const requestOauth = async () =>{
    const link = "https://id.twitch.tv/oauth2/token?client_id=" + process.env.clientId + "&client_secret=" + process.env.clientSecret + "&grant_type=client_credentials";
    try {
        const response = await axios.post(link);
        // console.log(response.data, link);
        // console.log(response.data.explanation);
        return response.data.access_token;
    } catch (error) {
        // console.log(error.response.body, link);
        return error;
    }
};

const helixRequest = async (names) =>{
    const link = "https://api.twitch.tv/helix/users?" + names;
    const oauth = await requestOauth();
    try {
        const response = await axios.get(link,{
            headers:{
                'Authorization': 'Bearer ' + oauth,
                'Client-ID' : process.env.clientId
            }
        });
        // console.log(response.data, link);
        return response.data.data;
    }catch (error) {
        console.log(error.response.body);
        return error;
    }
};

const storeDB = async (channelId, data) => {
    const newEntry = {
        TableName: 'chat-royale-data',
        Item: {
            channel: channelId,
            viewers: data,
            isActive: true
        }
    };
    return await documentClient.put(newEntry).promise();
};

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

const postHandler = async(channelId, data) =>{

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
    // const viewers = await getViewerHandler(122313);
    var data = event['body'];
    console.log(data)
    // const message = "New Players--" + viewers.toString() 
    // await storeDB(channelId, viewers);
    // const res = await sendBroadcast(channelId, message)
    // console.log(payload);
    return response(200, 'message');
};