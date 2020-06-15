/**
 *    Copyright 2018 Amazon.com, Inc. or its affiliates
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

const fs = require('fs');
const Hapi = require('hapi');
const path = require('path');
const Boom = require('boom');
const color = require('color');
const ext = require('commander');
const jsonwebtoken = require('jsonwebtoken');
const request = require('request');

// The developer rig uses self-signed certificates.  Node doesn't accept them
// by default.  Do not use this in production.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Use verbose logging during development.  Set this to false for production.
const verboseLogging = true;
const verboseLog = verboseLogging ? console.log.bind(console) : () => { };

// Service state variables
const initialColor = color('#6441A4');      // super important; bleedPurple, etc.
const serverTokenDurationSec = 30;          // our tokens for pubsub expire after 30 seconds
const userCooldownMs = 1000;                // maximum input rate per user to prevent bot abuse
const userCooldownClearIntervalMs = 60000;  // interval to reset our tracking object
const channelCooldownMs = 1000;             // maximum broadcast rate per channel
const bearerPrefix = 'Bearer ';             // HTTP authorization headers have this prefix
const colorWheelRotation = 30;
let channelNewest = {};
const channelTop = {};
let channelPosts = {}
const channelCooldowns = {};                // rate limit compliance
let userCooldowns = {};                     // spam prevention

const STRINGS = {
  secretEnv: usingValue('secret'),
  clientIdEnv: usingValue('client-id'),
  ownerIdEnv: usingValue('owner-id'),
  serverStarted: 'Server running at %s',
  secretMissing: missingValue('secret', 'EXT_SECRET'),
  clientIdMissing: missingValue('client ID', 'EXT_CLIENT_ID'),
  ownerIdMissing: missingValue('owner ID', 'EXT_OWNER_ID'),
  messageSendError: 'Error sending message to channel %s: %s',
  pubsubResponse: 'Message to c:%s returned %s',
  cyclingColor: 'Cycling color for c:%s on behalf of u:%s',
  colorBroadcast: 'Broadcasting color %s for c:%s',
  sendColor: 'Sending color %s to c:%s',
  cooldown: 'Please wait before clicking again',
  invalidAuthHeader: 'Invalid authorization header',
  invalidJwt: 'Invalid JWT',
};

ext.
  version(require('../package.json').version).
  option('-s, --secret <secret>', 'Extension secret').
  option('-c, --client-id <client_id>', 'Extension client ID').
  option('-o, --owner-id <owner_id>', 'Extension owner ID').
  option('-n, --client-secret <client_secret>', 'Extension client secret').
  parse(process.argv);

const ownerId = getOption('ownerId', 'EXT_OWNER_ID');
const secret = Buffer.from(getOption('secret', 'EXT_SECRET'), 'base64');
const clientId = getOption('clientId', 'EXT_CLIENT_ID');
const clientSecret = getOption('clientSecret', 'EXT_CLIENT_SECRET');

const serverOptions = {
  host: 'localhost',
  port: 8081,
  routes: {
    cors: {
      origin: ['*'],
    },
  },
};
const serverPathRoot = path.resolve(__dirname, '..', 'conf', 'server');
if (fs.existsSync(serverPathRoot + '.crt') && fs.existsSync(serverPathRoot + '.key')) {
  serverOptions.tls = {
    // If you need a certificate, execute "npm run cert".
    cert: fs.readFileSync(serverPathRoot + '.crt'),
    key: fs.readFileSync(serverPathRoot + '.key'),
  };
}
const server = new Hapi.Server(serverOptions);

(async () => {
  // Handle a viewer request to cycle the color.
  server.route({
    method: 'POST',
    path: '/upvote/message',
    handler: newMessageHandler,
  });

  // Handle a new viewer requesting the color.
  server.route({
    method: 'GET',
    path: '/upvote/initial',
    handler: initialQueryHandler,
  });

  // Handle a new vote request
  server.route({
    method: 'POST',
    path: '/upvote/upvote',
    handler: upvoteHandler,
  });
  // Handle removal of a post
  server.route({
    method: 'POST',
    path: '/upvote/remove',
    handler: removeHandler,
  });
  // Handle reset of all upvotes
  server.route({
    method: 'POST',
    path: '/upvote/reset',
    handler: resetHandler,
  });

  // Start the server.
  await server.start();
  console.log(STRINGS.serverStarted, server.info.uri);

  // Periodically clear cool-down tracking to prevent unbounded growth due to
  // per-session logged-out user tokens.
  setInterval(() => { userCooldowns = {}; }, userCooldownClearIntervalMs);
})();

function usingValue(name) {
  return `Using environment variable for ${name}`;
}

function missingValue(name, variable) {
  const option = name.charAt(0);
  return `Extension ${name} required.\nUse argument "-${option} <${name}>" or environment variable "${variable}".`;
}

// Get options from the command line or the environment.
function getOption(optionName, environmentName) {
  const option = (() => {
    if (ext[optionName]) {
      return ext[optionName];
    } else if (process.env[environmentName]) {
      console.log(STRINGS[optionName + 'Env']);
      return process.env[environmentName];
    }
    console.log(STRINGS[optionName + 'Missing']);
    process.exit(1);
  })();
  console.log(`Using "${option}" for ${optionName}`);
  return option;
}

// Verify the header and the enclosed JWT.
function verifyAndDecode(header) {
  if (header.startsWith(bearerPrefix)) {
    try {
      const token = header.substring(bearerPrefix.length);
      return jsonwebtoken.verify(token, secret, { algorithms: ['HS256'] });
    }
    catch (ex) {
      throw Boom.unauthorized(STRINGS.invalidJwt);
    }
  }
  throw Boom.unauthorized(STRINGS.invalidAuthHeader);
}
function checkTop(id){
  var list = channelTop[id]
  var minimum = list[14].votes
  console.log("LOGGGING", list[14], minimum)
  return minimum
}
function updateTop(id){
  list = channelTop[id]
  list.sort(function(x,y){return y['votes']-x['votes']})
}
function updateNewest(id,newPost){
  channelNewest[id] = channelNewest[id] || []
  if(channelNewest[id].length>=15){
    channelNewest[id].shift()
  }
  console.log("NEWEST",typeof(channelNewest[id]))
  channelNewest[id].push(newPost)
}
function requestOauth(){
  const link ="https://id.twitch.tv/oauth2/token?client_id=" + clientId + "&client_secret=" + clientSecret + "&grant_type=client_credentials";
  console.log("Oauth link",link)
  return new Promise(resolve=>{
    const options = {
      url: link
    }
    request.post(options, (err, res, body) =>{
      console.log("Oauth BODY-----",body)
      resolve(JSON.parse(body).access_token)
    });
  });
}
async function helixRequest(name){
  console.log("helix", name)
  var oauth = await requestOauth()
  console.log('token', oauth)
  link = "https://api.twitch.tv/helix/users?id=" + name
  console.log("link",link)
  return new Promise(resolve=>{
    const options = {
      url: link,
      headers: {
        'Client-ID' : clientId,
        'Authorization': 'Bearer ' + oauth
      }
    };
    request.get(options, (err, res, body) =>{
      console.log("BODY-----",body)
      // console.log("Response!!!!!", JSON.parse(body).data[0].display_name)
      message = JSON.parse(body).data[0].display_name
      resolve(message)
    })
  })
}

function initialQueryHandler(req){
  console.log('initialQueryHandler')
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;
  var listNew = channelNewest[channelId] || "N/A"
  var listTop = channelTop[channelId] || "N/A"
  console.log("!!!",typeof(listTop),listNew)
  const postnumber = 0
  if(typeof(listNew) == 'string' || typeof(listNew) == 'string'){
    var message = 'N/A'
  }
  else{
    var message = JSON.stringify(listTop) + '--' + JSON.stringify(listNew)
  }
  

  verboseLog("intial query", message, opaqueUserId);
  return message
}

async function newMessageHandler(req){
  console.log('newMessageHandler')
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;
  const postnumber = channelPosts[channelId]  + 1 || 1
  if(postnumber<2){
    channelNewest[channelId] = []
    channelTop[channelId] =  []
  }
  channelPosts[channelId] = postnumber
  data = req.payload
  var user = data.user
  if(user != 'User'){
    var username = await helixRequest(user)
  }
  else{
    var username = 'Anon'
  }
  console.log("data",data)
  data.votes = 0
  data.id = postnumber
  data.user = username
  updateNewest(channelId,data)
  //push to top if top not full
  if(channelTop[channelId].length<15){
    channelTop[channelId].push(data)
  }
  message = "N/A"
  attemptViewerBroadcast(channelId)
  return message
}
function upvoteHandler(req){
  console.log('upvoteHandler')
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;
  var isTop = false
  var isUpdated = false
  var target 
  data = req.payload
  target = data.voteId
  console.log("DATA",target)
  for(item in channelTop[channelId]){
    if(channelTop[channelId][item].id == target){
      isUpdated = true
      isTop = true
      channelTop[channelId][item].votes += 1
      target = channelTop[channelId][item]
      break;
    }
  }
  if(!isUpdated){
    for(item in channelNewest[channelId]){
      if(channelNewest[channelId][item].id == target){
        isUpdated = true
        channelNewest[channelId][item].votes += 1
        target = channelNewest[channelId][item]
        break;
      }
    }
  }
  if(!isTop){
    minimum = checkTop(channelId)
    // console.log('@@@@@@@', target.votes)
    // console.log('#######', minimum)
    if(target.votes > minimum){
      channelTop[channelId].pop()
      channelTop[channelId].push(target)
      updateTop(channelId)
    }
  }
  else{
    updateTop(channelId)
  }
  attemptViewerBroadcast(channelId)
  message = 'N/A'
  return message
}

function removeHandler(req){
  console.log('removeHandler')
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;
  data = req.payload
  target = data.voteId
  for(item in channelTop[channelId]){
    if(channelTop[channelId][item].id == target){
      channelTop[channelId].splice(item,1)
    }
  }
  for(item in channelNewest[channelId]){
    if(channelNewest[channelId][item].id == target){
      channelNewest[channelId].splice(item,1)
    }
  }
  attemptViewerBroadcast(channelId)
  message = 'N/A'
  return message
}

function resetHandler(req){
  console.log('resetHandler')
  const payload = verifyAndDecode(req.headers.authorization);
  const { channel_id: channelId, opaque_user_id: opaqueUserId } = payload;
  channelTop[channelId] = []
  channelNewest[channelId] = []
  channelPosts[channelId] = 0
  attemptViewerBroadcast(channelId,true)
  message = 'N/A'
  return message

}

function attemptViewerBroadcast(channelId, reset=false){
  const now = Date.now();
  const cooldown = channelCooldowns[channelId];
  if (!cooldown || cooldown.time < now) {
    // It is.
    sendViewerBroadcast(channelId,reset);
    channelCooldowns[channelId] = { time: now + channelCooldownMs };
  } else if (!cooldown.trigger) {
    // It isn't; schedule a delayed broadcast if we haven't already done so.
    cooldown.trigger = setTimeout(sendViewerBroadcast, now - cooldown.time, channelId,message);
  }
}

function sendViewerBroadcast(channelId,reset) {
  // Set the HTTP headers required by the Twitch API.
  const headers = {
    'Client-ID': clientId,
    'Content-Type': 'application/json',
    'Authorization': bearerPrefix + makeServerToken(channelId),
  };

  // Create the POST body for the Twitch API request.
  // var currentViewers = JSON.stringify(channelViewers[channelId]);
  // currentViewers = "Starting Array--" + currentViewers
  if(!reset){
    const topLength = channelTop[channelId].length
    const newLength = channelNewest[channelId].length
    if(topLength>10){
      var topMessage = channelTop[channelId].slice(0,10)
    }
    else{
      var topMessage = channelTop[channelId]
    }
    if(newLength>10){
      var pointer = newLength-10
      var newMessage = channelNewest[channelId].slice(pointer).reverse()
      // newMessage = newMessage.slice().reverse()
    }
    else{
      var newMessage = channelNewest[channelId].slice().reverse()
    }
    console.log("toplength",topLength)
    var message = JSON.stringify(topMessage) + '--' + JSON.stringify(newMessage)
  }
  else{
    var message = 'reset'
  }
  
  console.log("current", message)
  const body = JSON.stringify({
    content_type: 'application/json',
    message: message,
    targets: ['broadcast'],
  });

  // Send the broadcast request to the Twitch API.
  // verboseLog(STRINGS.colorBroadcast, currentColor, channelId);
  request(
    `https://api.twitch.tv/extensions/message/${channelId}`,
    {
      method: 'POST',
      headers,
      body,
    }
    , (err, res) => {
      if (err) {
        console.log(STRINGS.messageSendError, channelId, err);
      } else {
        verboseLog(STRINGS.pubsubResponse, channelId, res.statusCode);
      }
    });
}

// Create and return a JWT for use by this service.
function makeServerToken(channelId) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + serverTokenDurationSec,
    channel_id: channelId,
    user_id: ownerId, // extension owner ID for the call to Twitch PubSub
    role: 'external',
    pubsub_perms: {
      send: ['*'],
    },
  };
  return jsonwebtoken.sign(payload, secret, { algorithm: 'HS256' });
}

function userIsInCooldown(opaqueUserId) {
  // Check if the user is in cool-down.
  const cooldown = userCooldowns[opaqueUserId];
  const now = Date.now();
  if (cooldown && cooldown > now) {
    return true;
  }

  // Voting extensions must also track per-user votes to prevent skew.
  userCooldowns[opaqueUserId] = now + userCooldownMs;
  return false;
}
